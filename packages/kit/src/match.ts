/**
 * The dependency-free half of kit's server-data runtime: route-pattern
 * matching, the load resolver, and the endpoint matcher. Shared between the
 * browser runtime (`./runtime.ts`) and the node-side plugin (`./dev.ts`) —
 * nothing here may import `@implementjs/core` or `node:*`, since the plugin
 * half runs inside `vite.config.ts` under plain node.
 */

import { markErrorSource } from "./errors.ts";

/** Load results keyed by the server file that produced them (`docs/page.server.ts`). */
export type RouteData = Record<string, unknown>;

/** Pathname with no trailing slash (the root is `"/"`). */
export function normalizeRoutePath(pathname: string): string {
	let path = pathname.startsWith("/") ? pathname : `/${pathname}`;
	while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	return path;
}

// ---------------------------------------------------------------------------
// Pattern matching (the `/docs/:...slug` patterns the codegen emits)
// ---------------------------------------------------------------------------

type PatternSegment =
	| { param: false; value: string }
	| { param: true; rest: boolean; name: string };

function parsePattern(pattern: string): PatternSegment[] {
	return pattern
		.split("/")
		.filter(Boolean)
		.map((part) => {
			if (part.startsWith(":...")) return { param: true, rest: true, name: part.slice(4) };
			if (part.startsWith(":")) return { param: true, rest: false, name: part.slice(1) };
			return { param: false, value: part };
		});
}

/** The params a pattern binds on a path, or `null` when it does not match. */
export function matchRoutePattern(pattern: string, path: string): Record<string, string> | null {
	const segments = parsePattern(pattern);
	const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
	const last = segments[segments.length - 1];
	const hasRest = last !== undefined && last.param && last.rest;
	// a catch-all consumes one or more trailing segments; everything else is exact
	if (hasRest ? parts.length < segments.length : parts.length !== segments.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]!;
		if (segment.param) {
			params[segment.name] = segment.rest ? parts.slice(i).join("/") : parts[i]!;
		} else if (segment.value !== parts[i]) {
			return null;
		}
	}
	return params;
}

/** Static segments outrank params, and params outrank catch-alls, position by position. */
function patternSegmentRank(segment: PatternSegment): number {
	return segment.param ? (segment.rest ? 2 : 1) : 0;
}

/** Static segments outrank params, and params outrank catch-alls, position by position. */
export function comparePatterns(a: string, b: string): number {
	const left = parsePattern(a);
	const right = parsePattern(b);
	const length = Math.min(left.length, right.length);
	for (let i = 0; i < length; i++) {
		const difference = patternSegmentRank(left[i]!) - patternSegmentRank(right[i]!);
		if (difference !== 0) return difference;
	}
	return left.length - right.length;
}

/** The directory-name form of a pattern: `/docs/:...slug` → `/docs/[...slug]`. */
export function routeId(pattern: string): string {
	return pattern
		.split("/")
		.map((part) => (part.startsWith(":") ? `[${part.replace(/^:(\.\.\.)?/, "$1")}]` : part))
		.join("/");
}

// ---------------------------------------------------------------------------
// Server loads
// ---------------------------------------------------------------------------

/**
 * What a request handler and a `*.server.ts` load receive. `Params` narrows
 * through `./$types`; `locals` is whatever `src/hooks.server.ts` put there,
 * typed by the app through `App.Locals`.
 */
export type RequestEvent<Params extends Record<string, string> = Record<string, string>> = {
	request: Request;
	params: Params;
	url: URL;
	/** The matched route's id (`/docs/[...slug]`), or `null` when nothing matched. */
	route: { id: string | null };
	/** Per-request state set by `src/hooks.server.ts`, typed through `App.Locals`. */
	locals: App.Locals;
	/**
	 * `fetch`, bound to this request. Relative URLs resolve against
	 * `event.url`, `cookie` and `authorization` are forwarded on same-origin
	 * requests, and a same-origin request is dispatched **in-process** — back
	 * through the pipeline, hooks and all, with no socket in between. So a load
	 * calling its own app's endpoint costs a function call, not a round trip.
	 */
	fetch: typeof fetch;
	/**
	 * The generated API client bound to {@link RequestEvent.fetch} — the same
	 * `api` as `$implement/client`, answering from inside the process.
	 *
	 * ```ts
	 * const { data, error } = await api.GET("/api/posts/[id]", { params: { id } });
	 * ```
	 *
	 * Typed through `App.Api`, which the generated `.implement/` types fill in
	 * from the app's own route tree.
	 */
	api: App.Api;
	/** Whether this is a client navigation's `__data.json` request rather than a document request. */
	isDataRequest: boolean;
	/**
	 * Whatever the adapter hosting the app hands its requests — Cloudflare's
	 * `env` and `context`, say. `undefined` in dev, while prerendering, and
	 * under any adapter with nothing to offer. Typed by the app through
	 * `App.Platform`.
	 */
	platform: Readonly<App.Platform> | undefined;
	/** Adds headers to the response `resolve` produces. Each header may only be set once. */
	setHeaders: (headers: Record<string, string>) => void;
	getClientAddress: () => string;
};

/** What a `*.server.ts` load receives — the request event, `params` as plain strings. */
export type LoadEvent<Params extends Record<string, string> = Record<string, string>> =
	RequestEvent<Params>;

export type ServerLoad = (event: LoadEvent) => unknown;

export type RequestHandler = (event: RequestEvent) => Response | Promise<Response>;

/** A page route with the load chain feeding it, as the generated `$implement/pages` module emits it. */
export type PageRoute = {
	/** Full path pattern, `:param`/`:...rest` style (`/docs/:...slug`). */
	pattern: string;
	/** The route's id, directory-name style (`/docs/[...slug]`). */
	id: string;
	/** The route's load chain, root layout first, the page's own load last. */
	files: { id: string; load: ServerLoad }[];
};

export type PageMatch = { route: PageRoute; params: Record<string, string> };

/** The most specific page serving a path, or `null` when none does. */
export function matchPage(pages: PageRoute[], path: string): PageMatch | null {
	const sorted = [...pages].toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
	for (const route of sorted) {
		const params = matchRoutePattern(route.pattern, path);
		if (params !== null) return { route, params };
	}
	return null;
}

/**
 * Runs a route's load chain — every layout load down to the page's own, root
 * first — and returns the results keyed by server file. `null` when the route
 * has no loads, which is also what a page with nothing to load serves for its
 * `__data.json`.
 */
export async function runLoads(route: PageRoute, event: LoadEvent): Promise<RouteData | null> {
	if (route.files.length === 0) return null;
	const data: RouteData = {};
	for (const { id, load } of route.files) {
		try {
			data[id] = (await load(event)) ?? {};
		} catch (thrown) {
			// which load of the chain was running is the one thing the trace
			// cannot say once the failure is a few awaits deep in a helper
			throw markErrorSource(thrown, { kind: "load", file: id });
		}
	}
	return data;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export type EndpointRoute = {
	/** Path pattern of the endpoint's directory. */
	pattern: string;
	/** The endpoint's id, directory-name style (`/docs/[...slug]/.md`). */
	id: string;
	/** Extension a `.<ext>/server.ts` appends to the pattern; `null` for a plain `server.ts`. */
	extension: string | null;
	/** Relative path of the `server.ts` file, for error messages. */
	file: string;
	/** The endpoint module's namespace — `GET`, `POST`, … handlers by method. */
	module: Record<string, unknown>;
};

export type EndpointMatch = { route: EndpointRoute; params: Record<string, string> };

/** The most specific endpoint serving a path; extension endpoints outrank plain ones. */
export function matchEndpoint(endpoints: EndpointRoute[], path: string): EndpointMatch | null {
	const sorted = [...endpoints].toSorted(
		(a, b) =>
			comparePatterns(a.pattern, b.pattern) ||
			(a.extension === null ? 1 : 0) - (b.extension === null ? 1 : 0),
	);
	for (const route of sorted) {
		let base = path;
		if (route.extension !== null) {
			if (!path.endsWith(route.extension)) continue;
			base = normalizeRoutePath(path.slice(0, -route.extension.length));
		}
		const params = matchRoutePattern(route.pattern, base);
		if (params !== null) return { route, params };
	}
	return null;
}

/** Where a route's serialized data lives, in dev and in the prerendered build. */
export function dataPath(path: string): string {
	return path === "/" ? "/__data.json" : `${path}/__data.json`;
}
