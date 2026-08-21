import { mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { ViteDevServer } from "vite";
import type { ServerRoute } from "./codegen.ts";
import {
	matchEndpoint,
	matchRoutePattern,
	normalizeRoutePath,
	resolveLoads,
	type EndpointRoute,
	type LoadRoute,
} from "./match.ts";
import { extensionPattern } from "./scan.ts";

export const LOADS_ID = "$implement/loads";
export const ENDPOINTS_ID = "$implement/endpoints";

const DATA_SUFFIX = "/__data.json";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function toRequest(req: IncomingMessage, url: URL): Request {
	const method = req.method ?? "GET";
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const entry of value) headers.append(name, entry);
		} else {
			headers.set(name, value);
		}
	}
	const body =
		method === "GET" || method === "HEAD"
			? undefined
			: (Readable.toWeb(req) as unknown as BodyInit);
	const init: RequestInit = { method, headers, body };
	// streaming request bodies require half duplex
	if (body !== undefined) (init as { duplex?: string }).duplex = "half";
	return new Request(url, init);
}

async function sendResponse(res: ServerResponse, response: Response, head: boolean): Promise<void> {
	res.statusCode = response.status;
	response.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	if (head || response.body === null) {
		res.end();
		return;
	}
	res.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * The dev middleware behind kit's server files: serves `__data.json` requests
 * by running the matched route's load chain, and dispatches `server.ts`
 * endpoint requests (extension endpoints included) to their method handler.
 * Returns whether the request was handled.
 */
export async function handleServerRequest(options: {
	server: ViteDevServer;
	req: IncomingMessage;
	res: ServerResponse;
	hasLoads: boolean;
	hasEndpoints: boolean;
}): Promise<boolean> {
	const { server, req, res, hasLoads, hasEndpoints } = options;
	const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
	const path = normalizeRoutePath(url.pathname);

	if (path === DATA_SUFFIX || path.endsWith(DATA_SUFFIX)) {
		if (!hasLoads) {
			res.statusCode = 404;
			res.setHeader("content-type", "application/json");
			res.end("null");
			return true;
		}
		const base = path === DATA_SUFFIX ? "/" : path.slice(0, -DATA_SUFFIX.length);
		const { loads } = (await server.ssrLoadModule(LOADS_ID)) as { loads: LoadRoute[] };
		const data = await resolveLoads(loads, new URL(base + url.search, url.origin));
		res.setHeader("content-type", "application/json");
		if (data === null) {
			res.statusCode = 404;
			res.end("null");
		} else {
			res.end(JSON.stringify(data));
		}
		return true;
	}

	if (!hasEndpoints) return false;
	const { endpoints } = (await server.ssrLoadModule(ENDPOINTS_ID)) as {
		endpoints: EndpointRoute[];
	};
	const match = matchEndpoint(endpoints, path);
	if (match === null) return false;

	const method = req.method ?? "GET";
	const handlerName = method === "HEAD" && !("HEAD" in match.route.module) ? "GET" : method;
	const rawHandler = match.route.module[handlerName];
	if (typeof rawHandler !== "function") {
		res.statusCode = 405;
		res.setHeader("allow", METHODS.filter((name) => name in match.route.module).join(", "));
		res.end();
		return true;
	}
	const response = await rawHandler({ request: toRequest(req, url), params: match.params, url });
	await sendResponse(res, response, method === "HEAD");
	return true;
}

/**
 * The build-time half of the server files, run from the prerender `after`
 * hook: writes each load-bearing prerendered route's `__data.json` next to
 * its `index.html`, and renders every GET endpoint into a static file —
 * extension endpoints over params derive their concrete paths from the
 * prerendered routes that match their base pattern.
 */
export async function prerenderServerFiles(options: {
	routes: string[];
	outDir: string;
	load: (id: string) => Promise<Record<string, unknown>>;
	hasLoads: boolean;
	serverRoutes: ServerRoute[];
	logger: { info(message: string): void; warn(message: string): void };
}): Promise<void> {
	const { routes, outDir, load, hasLoads, serverRoutes, logger } = options;
	const write = (path: string, contents: string | Buffer) => {
		const out = join(outDir, path.slice(1));
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, contents);
	};

	if (hasLoads) {
		const { loads } = (await load(LOADS_ID)) as unknown as { loads: LoadRoute[] };
		let written = 0;
		for (const route of routes) {
			const data = await resolveLoads(loads, route);
			if (data === null) continue;
			write(route === "/" ? DATA_SUFFIX : `${route}${DATA_SUFFIX}`, JSON.stringify(data));
			written++;
		}
		logger.info(`wrote ${written} route data payloads`);
	}

	if (serverRoutes.length === 0) return;
	const { endpoints } = (await load(ENDPOINTS_ID)) as unknown as { endpoints: EndpointRoute[] };
	const failed: string[] = [];
	let written = 0;
	for (const endpoint of endpoints) {
		const rawHandler = endpoint.module.GET;
		if (typeof rawHandler !== "function") {
			logger.warn(`skipping ${endpoint.file} — only GET endpoints prerender`);
			continue;
		}
		let targets: string[];
		if (!endpoint.pattern.includes(":")) {
			targets = [
				endpoint.extension === null
					? endpoint.pattern
					: extensionPattern(endpoint.pattern, endpoint.extension),
			];
		} else if (endpoint.extension !== null) {
			targets = routes
				.filter((route) => matchRoutePattern(endpoint.pattern, route) !== null)
				.map((route) => extensionPattern(route, endpoint.extension!));
		} else {
			logger.warn(
				`skipping ${endpoint.file} — a param endpoint without an extension has no prerenderable paths`,
			);
			continue;
		}
		for (const target of targets) {
			const base =
				endpoint.extension === null
					? target
					: normalizeRoutePath(target.slice(0, -endpoint.extension.length));
			const params = matchRoutePattern(endpoint.pattern, base) ?? {};
			const url = new URL(target, "http://implement.internal");
			try {
				const response = await rawHandler({ request: new Request(url), params, url });
				if (!response.ok) {
					failed.push(`${target}: ${response.status}`);
					continue;
				}
				write(target, Buffer.from(await response.arrayBuffer()));
				written++;
			} catch (error) {
				failed.push(`${target}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	logger.info(`prerendered ${written} endpoint responses`);
	if (failed.length > 0) {
		throw new Error(`endpoint prerender failed:\n  ${failed.join("\n  ")}`);
	}
}
