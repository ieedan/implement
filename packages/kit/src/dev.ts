import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { collectDevStyles, injectSsr } from "@implementjs/vite";
import type { Connect, ViteDevServer } from "vite";
import type { ServerRoute } from "./codegen.ts";
import { dataPath, matchRoutePattern, type EndpointRoute, type RequestHandler } from "./match.ts";
import { extensionPattern } from "./scan.ts";
import { INTERNAL_ORIGIN, type KitServer } from "./server.ts";

export const PAGES_ID = "$implement/pages";
export const ENDPOINTS_ID = "$implement/endpoints";
export const HOOKS_ID = "$implement/hooks";

/** Vite's own dev URLs (`/@vite/client`, `/@fs/…`) are never app routes. */
const VITE_INTERNAL = /^\/@/;

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
 * The dev middleware behind kit's server files: hands every request that got
 * past Vite's own asset middlewares to the app's request pipeline — the
 * `hooks.server.ts` `handle` hook, then the page render, the `server.ts`
 * endpoint, or the `__data.json` payload the request resolves to. Returns
 * whether the request was handled.
 */
export async function handleServerRequest(options: {
	server: ViteDevServer;
	req: Connect.IncomingMessage;
	res: ServerResponse;
	/** The generated server entry, which exports the app's pipeline. */
	entry: string;
	/** Absolute path of the app's html shell, the template page responses render into. */
	shell: string | null;
}): Promise<boolean> {
	const { server, req, res, entry, shell } = options;
	const path = req.url ?? "/";
	if (VITE_INTERNAL.test(path)) return false;

	const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
	const { respond } = (await server.ssrLoadModule(entry)) as unknown as KitServer;
	const response = await respond(toRequest(req, url), {
		getClientAddress: () => req.socket.remoteAddress ?? "",
		document: async ({ render, transform }) => {
			if (shell === null) {
				throw new Error("no html shell to render into — add a src/index.html");
			}
			// the same transform pipeline Vite runs on an index.html it serves
			// itself (client injection, plugins), then the app's own render
			const template = await server.transformIndexHtml(
				"/index.html",
				readFileSync(shell, "utf8"),
				req.originalUrl,
			);
			const page = injectSsr(template, render, await collectDevStyles(server, entry));
			return transform === null ? page : await transform(page);
		},
	});
	await sendResponse(res, response, (req.method ?? "GET") === "HEAD");
	return true;
}

/**
 * The build-time half of the server files, run from the prerender `after`
 * hook: writes each load-bearing prerendered route's `__data.json` next to
 * its `index.html`, and renders every GET endpoint into a static file —
 * extension endpoints over params derive their concrete paths from the
 * prerendered routes that match their base pattern. Both go through the
 * app's request pipeline, so `hooks.server.ts` runs for them the same way it
 * does in dev.
 */
export async function prerenderServerFiles(options: {
	routes: string[];
	outDir: string;
	load: (id: string) => Promise<Record<string, unknown>>;
	/** The generated server entry, which exports the app's pipeline. */
	entry: string;
	hasLoads: boolean;
	serverRoutes: ServerRoute[];
	logger: { info(message: string): void; warn(message: string): void };
}): Promise<void> {
	const { routes, outDir, load, entry, hasLoads, serverRoutes, logger } = options;
	const write = (path: string, contents: string | Buffer) => {
		const out = join(outDir, path.slice(1));
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, contents);
	};
	const { respond } = (await load(entry)) as unknown as KitServer;
	const get = (path: string) => respond(new Request(new URL(path, INTERNAL_ORIGIN)));

	if (hasLoads) {
		let written = 0;
		for (const route of routes) {
			const response = await get(dataPath(route));
			if (!response.ok) continue;
			write(dataPath(route), await response.text());
			written++;
		}
		logger.info(`wrote ${written} route data payloads`);
	}

	if (serverRoutes.length === 0) return;
	const { endpoints } = (await load(ENDPOINTS_ID)) as unknown as { endpoints: EndpointRoute[] };
	const failed: string[] = [];
	let written = 0;
	for (const endpoint of endpoints) {
		const handler = endpoint.module.GET as RequestHandler | undefined;
		if (handler === undefined) {
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
			try {
				const response = await get(target);
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
