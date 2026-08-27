import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import type { Duplex } from "node:stream";
import { collectDevStyles, injectSsr } from "@implementjs/vite";
import type { Connect, ViteDevServer } from "vite";
import type { ServerRoute } from "./codegen.ts";
import { dataPath, matchRoutePattern, type EndpointRoute, type RequestHandler } from "./match.ts";
import { sendResponse, serveSockets, toRequest } from "./node.ts";
import { extensionPattern } from "./scan.ts";
import {
	formatServerError,
	INTERNAL_ORIGIN,
	type KitServer,
	type ServerErrorReport,
} from "./server.ts";

export const PAGES_ID = "$implement/pages";
export const ENDPOINTS_ID = "$implement/endpoints";
export const HOOKS_ID = "$implement/hooks";

/** Vite's own dev URLs (`/@vite/client`, `/@fs/…`) are never app routes. */
const VITE_INTERNAL = /^\/@/;

/** Roughly what picocolors decides, without the dependency. */
const COLOR =
	!("NO_COLOR" in process.env) &&
	("FORCE_COLOR" in process.env ||
		"CI" in process.env ||
		(process.stdout.isTTY && process.env["TERM"] !== "dumb"));

const dim = (text: string) => (COLOR ? `\u001B[2m${text}\u001B[22m` : text);
const boldRed = (text: string) => (COLOR ? `\u001B[1m\u001B[31m${text}\u001B[39m\u001B[22m` : text);
const boldYellow = (text: string) =>
	COLOR ? `\u001B[1m\u001B[33m${text}\u001B[39m\u001B[22m` : text;

/**
 * Kit's own tag for a log line. Vite stamps `[vite]` on anything it timestamps
 * for you, and an error thrown by a route's server file belongs to the app and
 * to kit, not to the dev server that carried the request — so the timestamp and
 * the tag are written here and the message goes to Vite's logger already dressed.
 */
function tagged(message: string): string {
	return `${dim(new Date().toLocaleTimeString())} ${boldRed("[implement]")} ${message}`;
}

/** The same tag in the colour a warning wears, for what is worth saying but not an error. */
export function taggedWarning(message: string): string {
	return `${dim(new Date().toLocaleTimeString())} ${boldYellow("[implement]")} ${message}`;
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
	/** Routes directory relative to the Vite root, for naming the file an error came from. */
	routes: string;
}): Promise<boolean> {
	const { server, req, res, entry, shell, routes } = options;
	const path = req.url ?? "/";
	if (VITE_INTERNAL.test(path)) return false;

	const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Generated server entry exports the app request pipeline.
	const { respond } = (await server.ssrLoadModule(entry)) as unknown as KitServer;
	const response = await respond(toRequest(req, url), {
		getClientAddress: () => req.socket.remoteAddress ?? "",
		// a load or an endpoint that throws answers the browser with a 500 and
		// nothing else — in dev the terminal is where you find out why
		onError: (report) => {
			server.config.logger.error(
				tagged(formatServerError(report, { root: server.config.root, routes })),
			);
		},
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
 * Subprotocols Vite's own dev channels ask for. The dev server and the app
 * share one `httpServer`, so both `upgrade` listeners see every handshake —
 * and an app that happens to serve a socket at the same path as the HMR
 * channel must not be the one that answers it.
 */
const VITE_PROTOCOLS = new Set(["vite-hmr", "vite-ping"]);

/**
 * The dev middleware's socket half: hands an upgrade request to the app's
 * pipeline, exactly as `handleServerRequest` hands it an ordinary one.
 * Returns whether the socket was taken — `false` leaves it for Vite's HMR
 * channel, and for anything else listening on the same server.
 */
export async function handleUpgrade(options: {
	server: ViteDevServer;
	req: IncomingMessage;
	socket: Duplex;
	head: Buffer;
	/** The generated server entry, which exports the app's pipeline. */
	entry: string;
	/** Routes directory relative to the Vite root, for naming the file an error came from. */
	routes: string;
}): Promise<boolean> {
	const { server, req, socket, head, entry, routes } = options;
	const requested = req.headers["sec-websocket-protocol"];
	const protocols = (Array.isArray(requested) ? requested.join(",") : (requested ?? ""))
		.split(",")
		.map((value) => value.trim());
	if (protocols.some((protocol) => VITE_PROTOCOLS.has(protocol))) return false;

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Generated server entry exports the app request pipeline.
	const { upgrade } = (await server.ssrLoadModule(entry)) as unknown as KitServer;
	const listener = serveSockets(upgrade, {
		onError: (report) => {
			server.config.logger.error(
				tagged(formatServerError(report, { root: server.config.root, routes })),
			);
		},
	});
	if (await listener(req, socket, head)) return true;

	// No socket route claims this path, and the request was not one of Vite's
	// own channels. A deployed server drops such a socket; here something else
	// on this server may still want it, so the question is whether anything
	// answered — a handshake is bytes on the wire, written synchronously by
	// every `upgrade` listener there is. Nothing written means nobody did, and
	// a socket nobody answers waits for as long as the client will let it.
	if (!socket.destroyed && written(socket) === 0) socket.destroy();
	return false;
}

/** Bytes written to a socket, or `0` for a duplex that does not count them. */
function written(socket: Duplex & { bytesWritten?: unknown }): number {
	return typeof socket.bytesWritten === "number" ? socket.bytesWritten : 0;
}

/** Whether a response is a live event stream rather than a body with an end. */
function isEventStream(response: Response): boolean {
	const type = (response.headers.get("content-type") ?? "").trim().toLowerCase();
	return /^text\/event-stream\b/.test(type);
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
	/**
	 * Whether an endpoint should become a file. Defaults to every GET endpoint,
	 * which is what a static build needs; a server adapter passes the app's
	 * prerender policy instead.
	 */
	shouldPrerender?: (route: { file: string }) => boolean | Promise<boolean>;
	logger: {
		info(message: string): void;
		warn(message: string): void;
		error(message: string): void;
	};
	/** Vite root and routes directory, for naming the file an error came from. */
	source: { root: string; routes: string };
	/** Every file written, as site-root-relative paths. */
}): Promise<string[]> {
	const { routes, outDir, load, entry, hasLoads, serverRoutes, logger, source } = options;
	const shouldPrerender = options.shouldPrerender ?? (() => true);
	const files: string[] = [];
	const write = (path: string, contents: string | Buffer) => {
		const out = join(outDir, path.slice(1));
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, contents);
		files.push(path);
	};
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Generated server entry exports the app request pipeline.
	const { respond } = (await load(entry)) as unknown as KitServer;
	const report = (error: ServerErrorReport) => {
		logger.error(tagged(formatServerError(error, source)));
	};
	// the build writes these files from the same pipeline dev serves them with,
	// so a load or an endpoint that throws has to say so here too — a skipped
	// payload otherwise looks like a route that simply had nothing to write
	const get = (path: string) =>
		respond(new Request(new URL(path, INTERNAL_ORIGIN)), { onError: report });

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

	if (serverRoutes.length === 0) return files;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Generated endpoints module exports the compiled endpoint route table.
	const { endpoints } = (await load(ENDPOINTS_ID)) as unknown as { endpoints: EndpointRoute[] };
	const failed: string[] = [];
	let written = 0;
	for (const endpoint of endpoints) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Endpoint module handlers are keyed by HTTP method name.
		const handler = endpoint.module.GET as RequestHandler | undefined;
		if (!(await shouldPrerender(endpoint))) continue;
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
				.filter((route) => matchRoutePattern(endpoint.pattern, route, "structure") !== null)
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
				// an event stream ends when its source does, which for a live one is
				// never — reading it into a file would hang the build with nothing
				// said about why
				if (isEventStream(response)) {
					await response.body?.cancel();
					failed.push(
						`${target}: an event stream cannot be a file — add \`export const prerender = false\` to ${endpoint.file}, and an adapter to serve it`,
					);
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
	return files;
}
