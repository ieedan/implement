/**
 * The dependency-free half of kit's server-data runtime: route-pattern
 * matching, the load resolver, and the endpoint matcher. Shared between the
 * browser runtime (`./runtime.ts`) and the node-side plugin (`./dev.ts`) —
 * nothing here may import `@implementjs/core` or `node:*`, since the plugin
 * half runs inside `vite.config.ts` under plain node.
 */

import { markErrorSource } from "./errors.ts";
import { mismatch, type ParamMatchers } from "./params.ts";

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
	| { param: true; rest: boolean; name: string; matcher: string | null };

/** `:id`, `:id=integer`, `:...slug`, `:...slug=path`, or a static part. */
function parsePatternSegment(part: string): PatternSegment {
	if (!part.startsWith(":")) return { param: false, value: part };
	const rest = part.startsWith(":...");
	const body = part.slice(rest ? 4 : 1);
	const equals = body.indexOf("=");
	return equals === -1
		? { param: true, rest, name: body, matcher: null }
		: { param: true, rest, name: body.slice(0, equals), matcher: body.slice(equals + 1) };
}

function parsePattern(pattern: string): PatternSegment[] {
	return pattern.split("/").filter(Boolean).map(parsePatternSegment);
}

/**
 * How a caller wants `:param=<name>` segments treated. A table runs the
 * matchers, which is what deciding whether a route may serve a path means.
 * `"structure"` skips them and takes the segment as a string — for the callers
 * asking which route *owns* a path rather than whether it is servable: the
 * preload hints, the data chain behind an already-rendered page, the endpoint
 * prerenderer. Those run where the app's matcher modules are not loaded, and a
 * matcher cannot change which pattern a path belongs to once it has matched.
 */
export type MatcherMode = ParamMatchers | "structure";

/**
 * The params a pattern binds on a path, or `null` when it does not match. A
 * `:param=<name>` segment is handed to that matcher, which either rejects the
 * path — no match, and the caller moves on to the next route — or answers with
 * the value the param carries from here on, which is not necessarily a string.
 */
export function matchRoutePattern(
	pattern: string,
	path: string,
	matchers: MatcherMode,
): Record<string, unknown> | null {
	const segments = parsePattern(pattern);
	const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
	const last = segments[segments.length - 1];
	const hasRest = last !== undefined && last.param && last.rest;
	// a catch-all consumes one or more trailing segments; everything else is exact
	if (hasRest ? parts.length < segments.length : parts.length !== segments.length) return null;
	const params: Record<string, unknown> = {};
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]!;
		if (!segment.param) {
			if (segment.value !== parts[i]) return null;
			continue;
		}
		const raw = segment.rest ? parts.slice(i).join("/") : parts[i]!;
		if (segment.matcher === null || matchers === "structure") {
			params[segment.name] = raw;
			continue;
		}
		const matcher = matchers[segment.matcher];
		if (matcher === undefined) {
			throw new Error(
				`"${pattern}" matches its "${segment.name}" against "${segment.matcher}", which is not a registered param matcher`,
			);
		}
		const value = matcher.match(raw);
		if (value === mismatch) return null;
		params[segment.name] = value;
	}
	return params;
}

/**
 * Static segments outrank matched params, which outrank plain params, which
 * outrank catch-alls — a segment that can turn a path down is more specific
 * than one that takes anything.
 */
function patternSegmentRank(segment: PatternSegment): number {
	if (!segment.param) return 0;
	const base = segment.rest ? 3 : 1;
	return segment.matcher === null ? base + 1 : base;
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

/**
 * The directory-name form of a pattern: `/docs/:...slug` → `/docs/[...slug]`,
 * `/posts/:id=integer` → `/posts/[id=integer]`. The matcher stays in, since it
 * is part of what tells two sibling routes apart.
 */
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
export type RequestEvent<Params extends Record<string, unknown> = Record<string, string>> = {
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

/**
 * What a `*.server.ts` load receives — the request event with `params` as
 * plain strings, plus `parent()`.
 */
export type LoadEvent<
	Params extends Record<string, unknown> = Record<string, string>,
	ParentData = Record<string, unknown>,
> = RequestEvent<Params> & {
	/**
	 * What the loads above this one in the chain returned, merged root first —
	 * the same merge the component's `data` is, minus this load's own
	 * contribution. A layout resolves the workspace once and the pages under it
	 * read it rather than resolving it again:
	 *
	 * ```ts
	 * export default async function load({ parent }: LoadEvent) {
	 * 	const { workspace } = await parent();
	 * 	return { issues: await listIssues(workspace.id) };
	 * }
	 * ```
	 *
	 * Only ever waits on the loads *above* this one, so awaiting it cannot
	 * deadlock; a load that never calls it never waits for anything.
	 *
	 * Typed through the route's generated `./$types` — `LoadEvent` there is the
	 * page's parent chain, `LayoutLoadEvent` its layout's.
	 */
	parent: () => Promise<ParentData>;
};

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

export type PageMatch = { route: PageRoute; params: Record<string, unknown> };

/** The most specific page serving a path, or `null` when none does. */
export function matchPage(
	pages: PageRoute[],
	path: string,
	matchers: MatcherMode,
): PageMatch | null {
	const sorted = [...pages].toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
	for (const route of sorted) {
		const params = matchRoutePattern(route.pattern, path, matchers);
		if (params !== null) return { route, params };
	}
	return null;
}

/**
 * Runs a route's load chain — every layout load down to the page's own — and
 * returns the results keyed by server file. `null` when the route has no
 * loads, which is also what a page with nothing to load serves for its
 * `__data.json`.
 *
 * Every load is *started* in one pass, root first, so a chain of four loads
 * that need nothing from each other costs one round of work rather than four
 * in a row. Sequencing is opt-in and per load: `parent()` waits on the loads
 * above the one calling it, and on nothing else — which is why a page load
 * awaiting its layout's data cannot deadlock, and why the sibling page load
 * that does not care carries none of that wait.
 */
export async function runLoads(route: PageRoute, event: RequestEvent): Promise<RouteData | null> {
	if (route.files.length === 0) return null;
	/** Each load's result, chain order, filled as the loop starts them. */
	const running: Promise<unknown>[] = [];
	for (const { id, load } of route.files) {
		// taken before this load starts, so it holds exactly the chain above it:
		// `parent()` can wait on no load that is waiting on this one
		const above = [...running];
		const parent = async (): Promise<RouteData> => {
			const merged: RouteData = {};
			for (const value of await Promise.all(above)) Object.assign(merged, value);
			return merged;
		};
		const result = (async () => {
			try {
				return (await load({ ...event, parent })) ?? {};
			} catch (thrown) {
				// which load of the chain was running is the one thing the trace
				// cannot say once the failure is a few awaits deep in a helper
				throw markErrorSource(thrown, { kind: "load", file: id });
			}
		})();
		// the chain runs concurrently, so a load below may fail while one above it
		// is still going — the loop below reaches it eventually, but not before
		// the runtime has already called the rejection unhandled
		result.catch(() => {});
		running.push(result);
	}
	const data: RouteData = {};
	// awaited root first, so a failing layout is what the request reports even
	// when a load under it failed sooner — the order the chain used to run in
	for (const [index, { id }] of route.files.entries()) {
		data[id] = await running[index]!;
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

export type EndpointMatch = { route: EndpointRoute; params: Record<string, unknown> };

/** The most specific endpoint serving a path; extension endpoints outrank plain ones. */
export function matchEndpoint(
	endpoints: EndpointRoute[],
	path: string,
	matchers: MatcherMode,
): EndpointMatch | null {
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
		const params = matchRoutePattern(route.pattern, base, matchers);
		if (params !== null) return { route, params };
	}
	return null;
}

/** Where a route's serialized data lives, in dev and in the prerendered build. */
export function dataPath(path: string): string {
	return path === "/" ? "/__data.json" : `${path}/__data.json`;
}
