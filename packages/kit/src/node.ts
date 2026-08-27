/**
 * The Node side of serving a kit app: the bridge between `node:http`'s
 * request/response pair and the web-standard `Request`/`Response` the app's
 * pipeline speaks, plus the static-file middlewares a Node host needs in front
 * of it.
 *
 * The dev server uses the bridge (`./dev.ts`), and so does every adapter that
 * deploys to a Node runtime — `@implementjs/adapter-node` composes the three
 * middlewares here into its server, and a serverless Node function uses the
 * same `toRequest`/`sendResponse` pair with the platform serving the assets.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, normalize, sep } from "node:path";
import { Readable, type Duplex } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FetchHandler, HandleOptions, UpgradeHandler } from "./handler.ts";
import { isUpgradeRequest, type SocketSession } from "./socket.ts";
import {
	acceptWebSocket,
	handshakeProblem,
	refuseUpgrade,
	type WebSocketSettings,
} from "./websocket.ts";

// the wire-level knobs an adapter passes through to `serveSockets`
export type { WebSocketSettings } from "./websocket.ts";

/** A connect-style middleware, which is what both Vite and a plain Node server take. */
export type Middleware = (
	req: IncomingMessage,
	res: ServerResponse,
	next: (error?: unknown) => void,
) => void;

// ---------------------------------------------------------------------------
// The http <-> fetch bridge
// ---------------------------------------------------------------------------

export function toRequest(req: IncomingMessage, url: URL): Request {
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
			: // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node Readable streams convert to Fetch BodyInit for endpoint handlers.
				(Readable.toWeb(req) as unknown as BodyInit);
	const init: RequestInit = { method, headers, body };
	// streaming request bodies require half duplex
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RequestInit duplex is required for streaming request bodies.
	if (body !== undefined) (init as { duplex?: string }).duplex = "half";
	return new Request(url, init);
}

export async function sendResponse(
	res: ServerResponse,
	response: Response,
	head: boolean,
): Promise<void> {
	res.statusCode = response.status;
	response.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	if (head || response.body === null) {
		res.end();
		return;
	}
	// streamed rather than buffered: an endpoint answering with a file, a proxy,
	// or an event stream should not have to fit in memory first
	try {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node's Readable.fromWeb takes the platform ReadableStream.
		await pipeline(Readable.fromWeb(response.body as never), res);
	} catch (error) {
		// A client that goes away mid-stream aborts the socket, and `pipeline`
		// reports that as a failure. It is how a browser ends an event stream it
		// no longer needs, or cancels a download — routine, and nothing the app
		// can act on, so it must not surface as a request error.
		const code =
			typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
		if (code !== "ERR_STREAM_PREMATURE_CLOSE") throw error;
	}
}

export type OriginOptions = {
	/**
	 * The origin the app is served from (`https://example.com`). Set it when
	 * the app sits behind a proxy that does not forward the original host, or
	 * when it must not trust the ones that do.
	 */
	origin?: string;
	/** Header naming the original protocol. @default "x-forwarded-proto" */
	protocolHeader?: string;
	/** Header naming the original host. @default "host" */
	hostHeader?: string;
};

/**
 * The URL a request was made to, as the client saw it. A reverse proxy is the
 * normal case in production, so the forwarded protocol is honoured unless
 * `origin` pins it — otherwise every absolute URL the app builds (redirects,
 * canonical links, OAuth callbacks) comes out `http:` behind TLS termination.
 */
export function requestUrl(req: IncomingMessage, options: OriginOptions = {}): URL {
	const path = req.url ?? "/";
	if (options.origin !== undefined) return new URL(path, options.origin);
	const header = (name: string): string | undefined => {
		const value = req.headers[name.toLowerCase()];
		return Array.isArray(value) ? value[0] : value;
	};
	const host = header(options.hostHeader ?? "host") ?? "localhost";
	const forwarded = header(options.protocolHeader ?? "x-forwarded-proto");
	// a proxy may forward a list; the client's own protocol is the first entry
	const protocol =
		forwarded?.split(",")[0]?.trim() ??
		("encrypted" in req.socket && req.socket.encrypted === true ? "https" : "http");
	return new URL(path, `${protocol}://${host}`);
}

export type AddressOptions = {
	/**
	 * Header carrying the client address. `x-forwarded-for` is a list the
	 * proxies append to, so {@link AddressOptions.depth} says how many of them
	 * are yours; anything before that is client-supplied and must not be
	 * trusted. Unset means the socket's own address.
	 */
	header?: string;
	/** How many trusted proxies sit in front of the app. @default 1 */
	depth?: number;
};

/** The client's address, read from the socket or from a trusted proxy header. */
export function clientAddress(req: IncomingMessage, options: AddressOptions = {}): string {
	const socketAddress = req.socket.remoteAddress ?? "";
	if (options.header === undefined) return socketAddress;
	const raw = req.headers[options.header.toLowerCase()];
	const value = Array.isArray(raw) ? raw.join(",") : raw;
	if (value === undefined) return socketAddress;
	const hops = value.split(",").map((entry) => entry.trim());
	// the last hop is the proxy nearest the app, so counting back by the number
	// of proxies lands on the address the outermost trusted one saw
	const index = hops.length - (options.depth ?? 1);
	return hops[index] ?? hops[0] ?? socketAddress;
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

/** Enough of the web's content types to serve a built app; anything else downloads as bytes. */
const CONTENT_TYPES: Record<string, string> = {
	avif: "image/avif",
	css: "text/css; charset=utf-8",
	gif: "image/gif",
	htm: "text/html; charset=utf-8",
	html: "text/html; charset=utf-8",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	js: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	map: "application/json; charset=utf-8",
	md: "text/markdown; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	otf: "font/otf",
	pdf: "application/pdf",
	png: "image/png",
	svg: "image/svg+xml",
	ttf: "font/ttf",
	txt: "text/plain; charset=utf-8",
	wasm: "application/wasm",
	webm: "video/webm",
	webmanifest: "application/manifest+json",
	webp: "image/webp",
	woff: "font/woff",
	woff2: "font/woff2",
	xml: "application/xml; charset=utf-8",
};

export function contentType(file: string): string {
	const extension = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
	return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/** The pathname of a request url, decoded, or `null` when it is not decodable. */
function decodedPath(url: string): string | null {
	try {
		return decodeURI(new URL(url, "http://localhost").pathname);
	} catch {
		return null;
	}
}

/**
 * The file a path resolves to inside `dir`, or `null` when there is none —
 * including when the decoded path climbs back out of the directory, which
 * `..` in an encoded URL will happily try.
 */
function resolveFile(dir: string, path: string): string | null {
	const file = join(dir, normalize(path));
	if (file !== dir && !file.startsWith(dir + sep)) return null;
	if (!existsSync(file) || !statSync(file).isFile()) return null;
	return file;
}

export type StaticOptions = {
	/**
	 * Path prefixes to serve with an immutable, year-long cache — right for
	 * hashed build output and wrong for everything else, which is why it is a
	 * list of prefixes rather than a flag over the whole directory. `true`
	 * applies it to every file. @default false
	 */
	immutable?: boolean | string[];
};

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, max-age=0, must-revalidate";

/**
 * Serves the files under `dir` by path. Nothing here rewrites a path to a
 * document: a directory is a miss, so the request falls through to the
 * prerendered pages and then to the app.
 */
export function serveStatic(dir: string, options: StaticOptions = {}): Middleware {
	const immutable = options.immutable ?? false;
	const cacheFor = (path: string): string => {
		if (immutable === true) return IMMUTABLE;
		if (immutable === false) return REVALIDATE;
		return immutable.some((prefix) => path.startsWith(prefix)) ? IMMUTABLE : REVALIDATE;
	};

	return (req, res, next) => {
		if (res.writableEnded) return next();
		if (req.method !== "GET" && req.method !== "HEAD") return next();
		const path = decodedPath(req.url ?? "/");
		if (path === null) return next();
		const file = resolveFile(dir, path);
		if (file === null) return next();
		sendFile(res, file, cacheFor(path), req.method === "HEAD").catch(next);
	};
}

export type PrerenderedOptions = {
	/**
	 * The paths the build prerendered. It is a list rather than a look on disk
	 * because `index.html` is there either way — it is the shell the server
	 * renders into — and serving the unrendered shell for a page the app was
	 * about to render is the one failure this middleware must not have.
	 */
	pages: string[];
	/** A document to answer unknown paths with, relative to `dir` (`404.html`). */
	fallback?: string;
};

/**
 * Serves the prerendered documents under `dir`: `/docs` is `docs/index.html`.
 * A page that prerendered must never reach the app's renderer as well, or the
 * two answers can drift.
 */
export function servePrerendered(dir: string, options: PrerenderedOptions): Middleware {
	const pages = new Set(options.pages.map(normalizePath));
	const fallbackFile = options.fallback === undefined ? null : join(dir, options.fallback);

	return (req, res, next) => {
		if (res.writableEnded) return next();
		if (req.method !== "GET" && req.method !== "HEAD") return next();
		const path = decodedPath(req.url ?? "/");
		if (path === null) return next();
		const head = req.method === "HEAD";
		if (pages.has(normalizePath(path))) {
			const page = resolveFile(dir, join(path, "index.html"));
			if (page !== null) {
				sendFile(res, page, REVALIDATE, head).catch(next);
				return;
			}
		}
		if (fallbackFile === null || !existsSync(fallbackFile)) return next();
		sendFile(res, fallbackFile, REVALIDATE, head, 404).catch(next);
	};
}

/** Pathname with no trailing slash, so `/docs` and `/docs/` are the same page. */
function normalizePath(path: string): string {
	let normalized = path.startsWith("/") ? path : `/${path}`;
	while (normalized.length > 1 && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
	return normalized;
}

async function sendFile(
	res: ServerResponse,
	file: string,
	cacheControl: string,
	head: boolean,
	status = 200,
): Promise<void> {
	const stats = statSync(file);
	res.statusCode = status;
	res.setHeader("content-type", contentType(file));
	res.setHeader("content-length", stats.size);
	res.setHeader("cache-control", cacheControl);
	res.setHeader("last-modified", stats.mtime.toUTCString());
	if (head) {
		res.end();
		return;
	}
	await pipeline(createReadStream(file), res);
}

// ---------------------------------------------------------------------------
// The app itself
// ---------------------------------------------------------------------------

export type AppOptions = OriginOptions & {
	/** Where the client address comes from. */
	address?: AddressOptions;
	/** What the host hands the app as `event.platform`. */
	platform?: (req: IncomingMessage) => App.Platform;
	/** Called with every unexpected error the pipeline catches. */
	onError?: HandleOptions["onError"];
};

/**
 * The app's request pipeline as a middleware: everything the static and
 * prerendered middlewares in front of it did not answer becomes a `Request`,
 * goes through the app's hooks, and comes back a `Response`.
 */
export function serveApp(handler: FetchHandler, options: AppOptions = {}): Middleware {
	return (req, res, next) => {
		if (res.writableEnded) return next();
		const url = requestUrl(req, options);
		const request = toRequest(req, url);
		handler(request, {
			getClientAddress: () => clientAddress(req, options.address),
			platform: options.platform?.(req),
			onError: options.onError,
		})
			.then((response) => sendResponse(res, response, (req.method ?? "GET") === "HEAD"))
			.then(undefined, next);
	};
}

// ---------------------------------------------------------------------------
// WebSockets
// ---------------------------------------------------------------------------

/**
 * A `node:http` `upgrade` listener. Resolves to whether it took the socket —
 * `false` leaves it alone, which is what lets kit's sockets share a server
 * with something else that speaks its own protocol (Vite's HMR channel in
 * dev, a proxy's own tunnel).
 */
export type UpgradeListener = (
	req: IncomingMessage,
	socket: Duplex,
	head: Buffer,
) => Promise<boolean>;

export type SocketServeOptions = AppOptions & {
	/** Wire-level settings: the payload cap, the heartbeat, the close timeout. */
	socket?: WebSocketSettings;
};

/**
 * The app's socket routes as an `upgrade` listener.
 *
 * ```js
 * const sockets = serveSockets(upgrade);
 * server.on("upgrade", (req, socket, head) => {
 * 	sockets(req, socket, head).then((handled) => {
 * 		if (!handled) socket.destroy();
 * 	});
 * });
 * ```
 *
 * The request goes through the app's pipeline first — `hooks.server.ts` runs,
 * `event.locals` is filled in, and the route's `upgrade` hook decides — and
 * only a request that survives all of that gets a handshake. A refusal is
 * written to the socket as an ordinary HTTP response, which is what a client
 * sees as a handshake that never completed.
 */
export function serveSockets(
	upgrade: UpgradeHandler,
	options: SocketServeOptions = {},
): UpgradeListener {
	return async (req, socket, head) => {
		if (socket.destroyed) return false;
		const url = requestUrl(req, options);
		const request = toRequest(req, url);
		// something else's protocol, or a plain request that arrived here by
		// mistake — either way it is not kit's socket to answer
		if (!isUpgradeRequest(request)) return false;

		const result = await upgrade(request, {
			getClientAddress: () => clientAddress(req, options.address),
			platform: options.platform?.(req),
			onError: options.onError,
		});
		// no route here accepts upgrades: leave the socket for whoever else is
		// listening, rather than answering for a path this app does not serve
		if (result === null) return false;
		if (socket.destroyed) return true;

		if (!result.accepted) {
			await refuseUpgrade(socket, result.response);
			return true;
		}
		// checked after the route claimed the path, not before: a broken handshake
		// at a path nothing serves is not this app's to complain about
		const problem = handshakeProblem(req);
		if (problem !== null) {
			await refuseUpgrade(
				socket,
				new Response(problem, {
					status: 400,
					headers: { "content-type": "text/plain; charset=utf-8", "sec-websocket-version": "13" },
				}),
			);
			return true;
		}

		let session: SocketSession | undefined;
		const connection = acceptWebSocket({
			req,
			socket,
			head,
			headers: result.headers,
			settings: options.socket,
			events: {
				message: (data) => session?.message(data),
				close: (details) => session?.closed(details),
				error: (error) => session?.failed(error),
				drain: () => session?.drained(),
			},
		});
		session = result.accept(connection);
		session.open();
		// frames only start flowing here, so nothing can reach a handler before
		// the session that owns it exists
		connection.start();
		return true;
	};
}

/** Runs a chain of middlewares, ending in a 404 when every one of them passes. */
export function compose(middlewares: Middleware[]): Middleware {
	return (req, res, done) => {
		const run = (index: number, error?: unknown): void => {
			if (error !== undefined) return done(error);
			const middleware = middlewares[index];
			if (middleware === undefined) return done();
			middleware(req, res, (next) => {
				run(index + 1, next);
			});
		};
		run(0);
	};
}
