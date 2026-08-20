/**
 * The dependency-free half of kit's server-data runtime: route-pattern
 * matching, the load resolver, and the endpoint matcher. Shared between the
 * browser runtime (`./runtime.ts`) and the node-side plugin (`./dev.ts`) —
 * nothing here may import `@implementjs/core` or `node:*`, since the plugin
 * half runs inside `vite.config.ts` under plain node.
 */

/** Load results keyed by the server file that produced them (`docs/index.server.ts`). */
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
export function comparePatterns(a: string, b: string): number {
	const rank = (segment: PatternSegment) => (segment.param ? (segment.rest ? 2 : 1) : 0);
	const left = parsePattern(a);
	const right = parsePattern(b);
	const length = Math.min(left.length, right.length);
	for (let i = 0; i < length; i++) {
		const difference = rank(left[i]!) - rank(right[i]!);
		if (difference !== 0) return difference;
	}
	return left.length - right.length;
}

// ---------------------------------------------------------------------------
// Server loads
// ---------------------------------------------------------------------------

/** What a `*.server.ts` load receives. `Params` narrows through `./$types`. */
export type LoadEvent<Params extends Record<string, string> = Record<string, string>> = {
	params: Params;
	url: URL;
};

export type ServerLoad = (event: LoadEvent) => unknown;

export type LoadRoute = {
	pattern: string;
	/** The route's load chain, root layout first, the page's own load last. */
	files: { id: string; load: ServerLoad }[];
};

/** What a `server.ts` endpoint handler receives. `Params` narrows through `./$types`. */
export type RequestEvent<Params extends Record<string, string> = Record<string, string>> = {
	request: Request;
	params: Params;
	url: URL;
};

export type RequestHandler = (event: RequestEvent) => Response | Promise<Response>;

/**
 * Runs the load chain of the route matching `url`: every layout load down to
 * the page's own, root first. Returns the results keyed by server file, or
 * `null` when no load-bearing route matches.
 */
export async function resolveLoads(
	loads: LoadRoute[],
	url: string | URL,
): Promise<RouteData | null> {
	const target = typeof url === "string" ? new URL(url, "http://implement.internal") : url;
	const path = normalizeRoutePath(target.pathname);
	const sorted = [...loads].sort((a, b) => comparePatterns(a.pattern, b.pattern));
	for (const route of sorted) {
		const params = matchRoutePattern(route.pattern, path);
		if (params === null) continue;
		const data: RouteData = {};
		for (const { id, load } of route.files) {
			data[id] = (await load({ params, url: target })) ?? {};
		}
		return data;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export type EndpointRoute = {
	/** Path pattern of the endpoint's directory. */
	pattern: string;
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
	const sorted = [...endpoints].sort(
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
