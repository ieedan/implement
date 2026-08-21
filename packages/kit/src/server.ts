import {
	matchEndpoint,
	matchPage,
	normalizeRoutePath,
	runLoads,
	type EndpointMatch,
	type EndpointRoute,
	type PageMatch,
	type PageRoute,
	type RequestEvent,
	type RequestHandler,
	type RouteData,
} from "./match.ts";

/**
 * Kit's server request pipeline: the `src/hooks.server.ts` contract
 * (`handle`, `handleError`, `init`), the `error` / `redirect` control-flow
 * helpers, `sequence`, and the `createKitServer` factory the generated
 * `.implement/entry-server.ts` wires up.
 *
 * Every server request — a page, an endpoint, or a client navigation's
 * `__data.json` — is turned into a `RequestEvent` and passed to the app's
 * `handle` hook, which produces the `Response` by calling `resolve(event)`.
 * Whatever `handle` put on `event.locals` on the way in is what the route's
 * loads and endpoint handlers read on the way through.
 */

declare global {
	/**
	 * The app's own server types, declared in `src/app.d.ts` and merged with
	 * the empty defaults kit ships:
	 *
	 * ```ts
	 * declare global {
	 * 	namespace App {
	 * 		interface Locals {
	 * 			user: User | null;
	 * 		}
	 * 	}
	 * }
	 * export {};
	 * ```
	 */
	namespace App {
		/** Per-request state `hooks.server.ts` sets and routes read — empty until the app fills it in. */
		interface Locals {}
		/** The shape `handleError` returns and the error page receives. */
		interface Error {
			message: string;
		}
	}
}

export type {
	EndpointRoute,
	LoadEvent,
	PageRoute,
	RequestEvent,
	RequestHandler,
	RouteData,
	ServerLoad,
} from "./match.ts";

export type MaybePromise<T> = T | Promise<T>;

/** Where a prerendered request comes from — nothing reads it, but a `Request` needs an origin. */
export const INTERNAL_ORIGIN = "http://implement.internal";

const DATA_SUFFIX = "/__data.json";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export type ResolveOptions = {
	/**
	 * Rewrites the rendered page's HTML. Kit renders a page in one pass, so
	 * this is called once with the whole document and `done: true`; returning
	 * `undefined` leaves the chunk alone.
	 */
	transformPageChunk?: (input: { html: string; done: boolean }) => MaybePromise<string | undefined>;
};

/** Turns an event into its response: the page render, the endpoint, or the route data. */
export type Resolve = (event: RequestEvent, options?: ResolveOptions) => Promise<Response>;

/**
 * The `handle` hook — kit's server middleware. It runs for every request and
 * owns the response: mutate `event` (typically `event.locals`) on the way in,
 * call `resolve` to produce the response, and change or replace it on the way
 * out.
 *
 * ```ts
 * // src/hooks.server.ts
 * import type { Handle } from "@implementjs/kit/server";
 *
 * export const handle: Handle = async ({ event, resolve }) => {
 * 	event.locals.user = await getUser(event.request.headers.get("cookie"));
 * 	return await resolve(event);
 * };
 * ```
 */
export type Handle = (input: { event: RequestEvent; resolve: Resolve }) => MaybePromise<Response>;

/**
 * The `handleError` hook: called with anything thrown out of `handle`, a
 * load, or an endpoint that wasn't an expected {@link error} or
 * {@link redirect}. Return the shape the error page and the error response
 * body should use; the default logs the error and says `Internal Error`.
 */
export type HandleServerError = (input: {
	error: unknown;
	event: RequestEvent;
	status: number;
	message: string;
}) => MaybePromise<App.Error | void>;

/** The `init` hook: awaited once, before the first request is handled. */
export type ServerInit = () => MaybePromise<void>;

/** What `src/hooks.server.ts` may export. Every hook is optional. */
export type ServerHooks = {
	handle?: Handle;
	handleError?: HandleServerError;
	init?: ServerInit;
};

const defaultHandle: Handle = ({ event, resolve }) => resolve(event);

/**
 * Chains `handle` hooks into one, left to right: the first handler's
 * `resolve` runs the second, and so on, with the real resolve at the end.
 * `transformPageChunk` options merge — an inner handler's transform runs
 * before the handlers that wrap it.
 *
 * ```ts
 * export const handle = sequence(authenticate, logRequests);
 * ```
 */
export function sequence(...handlers: Handle[]): Handle {
	if (handlers.length === 0) return defaultHandle;

	return ({ event, resolve }) => {
		const apply = (
			index: number,
			current: RequestEvent,
			parent: ResolveOptions,
		): MaybePromise<Response> =>
			handlers[index]!({
				event: current,
				resolve: (nested, options) => {
					const transformPageChunk = async (input: { html: string; done: boolean }) => {
						let html = input.html;
						if (options?.transformPageChunk !== undefined) {
							html = (await options.transformPageChunk({ ...input, html })) ?? "";
						}
						if (parent.transformPageChunk !== undefined) {
							html = (await parent.transformPageChunk({ ...input, html })) ?? "";
						}
						return html;
					};
					const merged: ResolveOptions = { transformPageChunk };
					return index < handlers.length - 1
						? Promise.resolve(apply(index + 1, nested, merged))
						: resolve(nested, merged);
				},
			});

		return apply(0, event, {});
	};
}

// ---------------------------------------------------------------------------
// error() / redirect()
// ---------------------------------------------------------------------------

/** Thrown by {@link error}: an expected failure with a status and a body. */
export class HttpError {
	readonly status: number;
	readonly body: App.Error;

	constructor(status: number, body: App.Error) {
		this.status = status;
		this.body = body;
	}

	toString(): string {
		return JSON.stringify(this.body);
	}
}

/** Thrown by {@link redirect}. */
export class Redirect {
	readonly status: number;
	readonly location: string;

	constructor(status: number, location: string) {
		this.status = status;
		this.location = location;
	}
}

/**
 * Throws an expected error: the request ends with `status` and `body`, the
 * error page renders it, and `handleError` is not called.
 *
 * ```ts
 * if (event.locals.user === null) error(401, "Not logged in");
 * ```
 */
export function error(status: number, body: App.Error | string): never {
	if (status < 400 || status > 599) {
		throw new Error(`error() status must be between 400 and 599, got ${status}`);
	}
	throw new HttpError(status, typeof body === "string" ? { message: body } : body);
}

/**
 * Throws a redirect: the request ends with `status` and a `location` header.
 *
 * ```ts
 * if (event.locals.user === null) redirect(303, "/login");
 * ```
 */
export function redirect(status: number, location: string | URL): never {
	if (status < 300 || status > 308) {
		throw new Error(`redirect() status must be between 300 and 308, got ${status}`);
	}
	throw new Redirect(status, location.toString());
}

export function isHttpError(thrown: unknown): thrown is HttpError {
	return thrown instanceof HttpError;
}

export function isRedirect(thrown: unknown): thrown is Redirect {
	return thrown instanceof Redirect;
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** What rendering a page produced — `@implementjs/core`'s `renderToString` result. */
export type PageRender = { html: string; head: string };

/**
 * Renders a page for a request: the app's router at `url`, or its `error.ts`
 * page when `error` is set. `null` when there is nothing to render — an app
 * without an `error.ts` has no error page.
 */
export type RenderPage = (input: {
	url: URL;
	data: RouteData | null;
	error: { code: number; message: string } | null;
}) => PageRender | null;

/** Applies the resolve options' `transformPageChunk`, or `null` when there is none. */
export type PageTransform = ((html: string) => Promise<string>) | null;

/**
 * Turns a page render into the document to send. Dev injects it into the
 * app's html shell with Vite's transforms applied; the prerenderer captures
 * it and lets `@implementjs/vite` do the injecting.
 */
export type PageDocument = (page: {
	render: PageRender & { data?: RouteData };
	event: RequestEvent;
	transform: PageTransform;
}) => MaybePromise<string>;

export type RespondOptions = {
	document?: PageDocument;
	getClientAddress?: () => string;
};

/** What the prerenderer consumes — `@implementjs/vite`'s `SsrResult`. */
export type RenderResult = PageRender & {
	data?: RouteData;
	transform?: (html: string) => Promise<string>;
};

export type KitServerOptions = {
	hooks: ServerHooks;
	/** Every page in the app, with the load chain feeding it. */
	pages: PageRoute[];
	/** Every `server.ts` endpoint in the app. */
	endpoints: EndpointRoute[];
	renderPage: RenderPage;
};

export type KitServer = {
	/** Handles one request end to end, hooks included. */
	respond: (request: Request, options?: RespondOptions) => Promise<Response>;
	/** The prerenderer's entry: the page render for a path, hooks included. */
	render: (url: string) => Promise<RenderResult>;
};

/**
 * Builds the request pipeline for an app. The generated
 * `.implement/entry-server.ts` calls this with the app's hooks, page and
 * endpoint manifests, and a renderer bound to its router — nothing else
 * should need to.
 */
export function createKitServer(options: KitServerOptions): KitServer {
	const { hooks, pages, endpoints, renderPage } = options;
	let started: Promise<void> | undefined;

	async function respond(request: Request, respondOptions: RespondOptions = {}): Promise<Response> {
		// awaited inside the try below, so a failing init answers like any other
		// error the pipeline catches rather than throwing out of `respond`
		started ??= (async () => {
			await hooks.init?.();
		})();

		const requestUrl = new URL(request.url);
		const path = normalizeRoutePath(requestUrl.pathname);
		const isDataRequest = path === DATA_SUFFIX || path.endsWith(DATA_SUFFIX);
		const routePath = isDataRequest
			? path === DATA_SUFFIX
				? "/"
				: normalizeRoutePath(path.slice(0, -DATA_SUFFIX.length))
			: path;
		// a data request is the page's request in disguise, so the event carries
		// the page's URL — a load sees the same `url` either way it was reached
		const url = isDataRequest
			? new URL(`${routePath}${requestUrl.search}${requestUrl.hash}`, requestUrl.origin)
			: requestUrl;

		const endpoint = isDataRequest ? null : matchEndpoint(endpoints, routePath);
		const page = endpoint === null ? matchPage(pages, routePath) : null;

		const headers = new Map<string, string>();
		const event: RequestEvent = {
			request,
			url,
			params: endpoint?.params ?? page?.params ?? {},
			route: { id: endpoint?.route.id ?? page?.route.id ?? null },
			locals: {} as App.Locals,
			isDataRequest,
			setHeaders: (values) => {
				for (const [name, value] of Object.entries(values)) {
					const header = name.toLowerCase();
					if (header === "set-cookie") {
						throw new Error("use a Set-Cookie header on the response instead of setHeaders");
					}
					if (headers.has(header)) throw new Error(`"${header}" has already been set`);
					headers.set(header, value);
				}
			},
			getClientAddress:
				respondOptions.getClientAddress ??
				(() => {
					throw new Error("getClientAddress is not available while prerendering");
				}),
		};

		/** The response the request would get with no hooks in the way. */
		const produce = async (current: RequestEvent, transform: PageTransform): Promise<Response> => {
			if (current.isDataRequest) {
				const data = page === null ? null : await runLoads(page.route, current);
				return data === null
					? new Response("null", { status: 404, headers: { "content-type": "application/json" } })
					: Response.json(data);
			}
			if (endpoint !== null) return await runEndpoint(endpoint, current);
			return await renderPageResponse(current, transform, page, page === null ? 404 : 200, null);
		};

		const renderPageResponse = async (
			current: RequestEvent,
			transform: PageTransform,
			match: PageMatch | null,
			status: number,
			pageError: { code: number; message: string } | null,
		): Promise<Response> => {
			const data = match === null ? null : await runLoads(match.route, current);
			const rendered = renderPage({ url: current.url, data, error: pageError });
			if (rendered === null) {
				return new Response(pageError?.message ?? "Not Found", {
					status,
					headers: { "content-type": "text/plain; charset=utf-8" },
				});
			}
			const result = data === null ? rendered : { ...rendered, data };
			const document = respondOptions.document ?? (({ render }) => render.html);
			const html = await document({ render: result, event: current, transform });
			return new Response(html, {
				status,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		};

		const failed = async (thrown: unknown, current: RequestEvent): Promise<Response> => {
			if (isRedirect(thrown)) {
				return new Response(null, {
					status: thrown.status,
					headers: { location: thrown.location },
				});
			}
			const status = isHttpError(thrown) ? thrown.status : 500;
			const body = isHttpError(thrown)
				? thrown.body
				: ((await (hooks.handleError ?? logError)({
						error: thrown,
						event: current,
						status,
						message: "Internal Error",
					})) ?? { message: "Internal Error" });
			if (current.isDataRequest || endpoint !== null) {
				return Response.json(body, { status });
			}
			try {
				return await renderPageResponse(current, null, null, status, {
					code: status,
					message: body.message,
				});
			} catch {
				// the error page itself is broken — say so in plain text rather than looping
				return new Response(body.message, {
					status,
					headers: { "content-type": "text/plain; charset=utf-8" },
				});
			}
		};

		const resolve: Resolve = async (resolveEvent, resolveOptions) => {
			const response = await produce(resolveEvent, pageTransform(resolveOptions));
			return withHeaders(response, headers);
		};

		try {
			await started;
			return await (hooks.handle ?? defaultHandle)({ event, resolve });
		} catch (thrown) {
			return withHeaders(await failed(thrown, event), headers);
		}
	}

	async function render(url: string): Promise<RenderResult> {
		let captured: RenderResult | undefined;
		const response = await respond(
			new Request(new URL(url, INTERNAL_ORIGIN), { headers: { accept: "text/html" } }),
			{
				document: ({ render: result, transform }) => {
					captured = transform === null ? result : { ...result, transform };
					return "";
				},
			},
		);
		if (captured === undefined) {
			throw new Error(
				`${url} did not render a page — hooks.server.ts answered with a ${response.status} response, which a prerendered page cannot represent`,
			);
		}
		return captured;
	}

	return { respond, render };
}

const logError: HandleServerError = ({ error: thrown }) => {
	console.error(thrown);
};

/** One pass over the whole document, since kit renders a page in one chunk. */
function pageTransform(options: ResolveOptions | undefined): PageTransform {
	const transformPageChunk = options?.transformPageChunk;
	if (transformPageChunk === undefined) return null;
	return async (html) => (await transformPageChunk({ html, done: true })) ?? "";
}

/** Applies `event.setHeaders` to a response, leaving headers it already carries alone. */
function withHeaders(response: Response, headers: Map<string, string>): Response {
	if (headers.size === 0) return response;
	// a response may have immutable headers (`Response.redirect()`), so copy
	const next = new Response(response.body, response);
	for (const [name, value] of headers) {
		if (!next.headers.has(name)) next.headers.set(name, value);
	}
	return next;
}

async function runEndpoint(match: EndpointMatch, event: RequestEvent): Promise<Response> {
	const { module } = match.route;
	const method = event.request.method;
	// HEAD falls back to GET, and the caller drops the body
	const name = method === "HEAD" && !("HEAD" in module) ? "GET" : method;
	const handler = module[name] as RequestHandler | undefined;
	if (handler === undefined) {
		return new Response(null, {
			status: 405,
			headers: { allow: METHODS.filter((allowed) => allowed in module).join(", ") },
		});
	}
	return await handler(event);
}
