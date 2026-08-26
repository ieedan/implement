import {
	A,
	derived,
	ImplementEffect,
	ImplementLifecycle,
	isReadable,
	location,
	navigateTo,
	normalizePath,
	Outlet,
	searchParam,
	signal,
	type Child,
	type ElementProps,
	type IMountable,
	type Mountable,
	type NavigateOptions,
	type OutletHelper,
	type Readable,
	type RouterLocation,
	type Signal,
} from "@implementjs/core";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * What a `:param=<name>` segment carries, by matcher name. Empty here — a
 * matcher's output type is the app's, not the router's, so an app (or
 * `@implementjs/kit`'s generated types) declares it:
 *
 * ```ts
 * declare module "@implementjs/router" {
 * 	interface ParamTypes {
 * 		integer: number;
 * 	}
 * }
 * ```
 *
 * A matcher with nothing declared for it stays a `string`, which is what an
 * unmatched param is anyway.
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- Declaration-merging surface: apps fill it in.
export interface ParamTypes {}

/** `"id=integer"` → `"id"`; a param with no matcher is its own name. */
type ParamOf<S extends string> = S extends `${infer Name}=${string}` ? Name : S;

/** `"id=integer"` → `ParamTypes["integer"]`, defaulting to `string`. */
type ValueOf<S extends string> = S extends `${string}=${infer Matcher}`
	? Matcher extends keyof ParamTypes
		? ParamTypes[Matcher]
		: string
	: string;

type SegmentParam<S extends string> = S extends `:...${infer Body}`
	? { [K in ParamOf<Body>]: Readable<ValueOf<Body>> }
	: S extends `:${infer Body}`
		? { [K in ParamOf<Body>]: Readable<ValueOf<Body>> }
		: {};

type PathParams<Path extends string> = Path extends `/${infer Rest}`
	? PathParams<Rest>
	: Path extends `${infer Head}/${infer Tail}`
		? SegmentParam<Head> & PathParams<Tail>
		: SegmentParam<Path>;

type ParamName<S extends string> = S extends `:...${infer Body}`
	? ParamOf<Body>
	: S extends `:${infer Body}`
		? ParamOf<Body>
		: never;

type PathParamNames<Path extends string> = Path extends `/${infer Rest}`
	? PathParamNames<Rest>
	: Path extends `${infer Head}/${infer Tail}`
		? ParamName<Head> | PathParamNames<Tail>
		: ParamName<Path>;

type RouteHandler<Params> = (params: Params) => Child;

type LayoutHandler<Params> = (child: Mountable, params: Params) => Child;

/**
 * Function keys (`"/"` and `layout`) must not depend on `T[K]`, or TypeScript
 * will not contextually type the callbacks. Other path keys are nested tables,
 * or a bare handler as shorthand for `{ "/": handler }`.
 */
type Routes<T, Params extends object = {}> = {
	[K in keyof T]: K extends "layout"
		? LayoutHandler<Params>
		: K extends "/"
			? RouteHandler<Params>
			: K extends `/${string}` | `:${string}` | `(${string})`
				? T[K] extends (...args: never) => unknown
					? RouteHandler<Prettify<Params & PathParams<K & string>>>
					: Routes<T[K], Prettify<Params & PathParams<K & string>>>
				: never;
};

/** `(group)` keys nest layouts without contributing a path segment. */
type NormalizeKey<K extends string> = K extends `(${string})`
	? ""
	: K extends `/${string}`
		? K
		: `/${K}`;

/** Union of every full path in the tree that has a render (`"/"` or bare handler). */
type RoutePaths<T, Prefix extends string = ""> = {
	[K in keyof T & string]: K extends "layout"
		? never
		: K extends "/"
			? Prefix extends ""
				? "/"
				: Prefix
			: T[K] extends (...args: never) => unknown
				? `${Prefix}${NormalizeKey<K>}`
				: RoutePaths<T[K], `${Prefix}${NormalizeKey<K>}`>;
}[keyof T & string];

/** The value each of a path's params carries, with any matcher's type applied. */
type PathParamValues<Path extends string> = {
	[K in keyof PathParams<Path>]: PathParams<Path>[K] extends Readable<infer V> ? V : string;
};

/**
 * What a caller fills a `:param` with. A matched param's own type is offered
 * first, and `string | number` stays allowed — building a URL only ever needs
 * something to stringify, and the matcher runs on the way back in.
 */
type HrefParams<P extends string> = {
	[K in keyof PathParamValues<P>]: PathParamValues<P>[K] | string | number;
};

type LinkParams<P extends string> = {
	[K in keyof PathParamValues<P>]:
		| PathParamValues<P>[K]
		| string
		| number
		| Readable<PathParamValues<P>[K] | string | number>;
};

type HrefArgs<P extends string> = [PathParamNames<P>] extends [never]
	? []
	: [params: HrefParams<P>];

type NavigateArgs<P extends string> = [PathParamNames<P>] extends [never]
	? [options?: NavigateOptions]
	: [params: HrefParams<P>, options?: NavigateOptions];

export type LinkProps<P extends string> = Omit<ElementProps<"a">, "href"> & {
	to: P;
	/** Replace the current history entry instead of pushing a new one. */
	replace?: boolean;
	/**
	 * Follow the link without scrolling to the top of the page. See
	 * {@link NavigateOptions.noScroll}.
	 */
	noScroll?: boolean;
} & ([PathParamNames<P>] extends [never] ? { params?: undefined } : { params: LinkParams<P> });

/**
 * Marks an `<a>` the router follows itself, rather than letting the browser
 * fetch a new document for it. {@link RouterHelper.Link} sets it; nothing else
 * does, because nothing else calls `preventDefault` on the click.
 *
 * Published rather than kept private because the difference is worth acting
 * on from outside: `@implementjs/kit` preloads a route's code and data on
 * hover, and that only pays off for a link whose click stays in the page. A
 * plain `<a>` is a full document load, and everything warmed for it is thrown
 * away the moment it is followed.
 */
export const ROUTED_LINK_ATTRIBUTE = "data-implement-link";

export type RouterError = {
	/** HTTP-style status — `404` for unmatched paths, `500` for render errors. */
	code: number;
	message: string;
};

export type RouterOptions = {
	/**
	 * The param matchers `:param=<name>` segments name, keyed by that name. A
	 * key naming a matcher that is not in here fails when the router is built,
	 * rather than becoming a route that quietly never matches.
	 */
	matchers?: RouteMatchers;
	/**
	 * Rendered when no route matches the current path (`code` 404) or a route
	 * render throws (`code` 500, or the thrown `{ code, message }` as-is).
	 */
	fallback?: (error: RouterError) => Child;
	/**
	 * Receives whatever a route render threw, before the fallback renders —
	 * integrators embedding a router (previews, sandboxes) route it to their
	 * own console. @default console.error
	 */
	onError?: (thrown: unknown) => void;
};

export type RouterHelper<T> = Mountable & {
	/** Reactive current location, shared by every router. */
	location: Readable<RouterLocation>;
	/** Build a URL for a route, filling `:param` segments. */
	href<P extends RoutePaths<T> & string>(path: P, ...args: HrefArgs<P>): string;
	/** Navigate programmatically. */
	navigate<P extends RoutePaths<T> & string>(path: P, ...args: NavigateArgs<P>): void;
	/**
	 * An `A` that navigates through the router. Modifier keys, non-left
	 * clicks, and `target` are respected. Sets `aria-current="page"` while
	 * the link's path is the current one (style with `aria-[current=page]:`).
	 * Following one scrolls to the top unless `noScroll` says otherwise.
	 */
	Link<P extends RoutePaths<T> & string>(props: LinkProps<P>, ...children: Child[]): Mountable;
	/** URL-synced query-string value. See {@link searchParam}. */
	searchParam: typeof searchParam;
};

// ---------------------------------------------------------------------------
// Param matchers
// ---------------------------------------------------------------------------

/**
 * What a matcher returns for a segment it does not serve: the route does not
 * match, and matching carries on with the next one.
 *
 * A well-known symbol rather than a private one, so a matcher built elsewhere
 * — `@implementjs/kit`'s `matcher()`, which cannot depend on this package —
 * rejects with the very same value.
 */
export const mismatch: unique symbol = Symbol.for("implementjs:param-mismatch");

export type Mismatch = typeof mismatch;

/**
 * A route param matcher: the gate a `:param=<name>` segment passes through,
 * and the value the param carries once it has.
 *
 * ```ts
 * const integer: RouteMatcher<number> = {
 * 	match: (value) => (/^\d+$/.test(value) ? Number(value) : mismatch),
 * };
 * ```
 *
 * Declare the type it produces in {@link ParamTypes} and `:id=integer` renders
 * with a `Readable<number>`.
 */
export type RouteMatcher<T = unknown> = { match: (value: string) => T | Mismatch };

/** The matchers a route tree names, keyed by the name its `:param=<name>` keys use. */
export type RouteMatchers = Record<string, RouteMatcher>;

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

type Segment =
	| { param: false; value: string }
	| { param: true; name: string; rest: boolean; matcher: string | null };

type RuntimeParams = Record<string, Readable<unknown>>;

type LayoutEntry = { handler: (child: Mountable, params: RuntimeParams) => Child };

type LeafRoute = {
	/** Full path pattern, root first. */
	segments: Segment[];
	/** Enclosing layouts, outermost first. Entry identity drives layout reuse. */
	layouts: LayoutEntry[];
	render: (params: RuntimeParams) => Child;
};

function parseKey(key: string): Segment[] {
	const raw = key.startsWith("/") ? key : `/${key}`;
	return (
		raw
			.split("/")
			.filter(Boolean)
			// `(group)` segments scope layouts without matching any part of the path
			.filter((part) => !(part.startsWith("(") && part.endsWith(")")))
			.map((part): Segment => {
				if (!part.startsWith(":")) return { param: false, value: part };
				const rest = part.startsWith(":...");
				const body = part.slice(rest ? 4 : 1);
				const equals = body.indexOf("=");
				return equals === -1
					? { param: true, rest, name: body, matcher: null }
					: { param: true, rest, name: body.slice(0, equals), matcher: body.slice(equals + 1) };
			})
	);
}

function routePath(segments: Segment[]): string {
	if (segments.length === 0) return "/";
	return `/${segments.map((segment) => (segment.param ? `:${segment.name}` : segment.value)).join("/")}`;
}

/** Every matcher a compiled tree names, so an unknown one is caught up front. */
function assertMatchersExist(routes: readonly LeafRoute[], matchers: RouteMatchers): void {
	for (const route of routes) {
		for (const segment of route.segments) {
			if (!segment.param || segment.matcher === null) continue;
			if (matchers[segment.matcher] === undefined) {
				throw new Error(
					`Route "${routePath(route.segments)}" matches ":${segment.name}" against "${segment.matcher}", which is not in the router's matchers`,
				);
			}
		}
	}
}

function assertRouteRender(value: unknown, at: string): LeafRoute["render"] {
	if (typeof value !== "function") {
		throw new Error(`Route render at ${at} must be a function, got ${typeof value}`);
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Validated render function matches the compiled route shape.
	return value as LeafRoute["render"];
}

function assertLayoutHandler(value: unknown): LayoutEntry["handler"] {
	if (typeof value !== "function") {
		throw new Error(`Route layout must be a function, got ${typeof value}`);
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Validated layout handler matches the compiled route shape.
	return value as LayoutEntry["handler"];
}

function compileNode(
	node: Record<string, unknown>,
	prefix: Segment[],
	layouts: LayoutEntry[],
	out: LeafRoute[],
): void {
	const scope =
		node.layout === undefined
			? layouts
			: [...layouts, { handler: assertLayoutHandler(node.layout) }];
	for (const [key, value] of Object.entries(node)) {
		if (key === "layout") continue;
		if (key === "/") {
			assertRestIsLast(prefix);
			out.push({
				segments: prefix,
				layouts: scope,
				render: assertRouteRender(value, routePath(prefix)),
			});
			continue;
		}
		// A bare handler at a path key is shorthand for `{ "/": handler }`.
		if (typeof value === "function") {
			const segments = [...prefix, ...parseKey(key)];
			assertRestIsLast(segments);
			out.push({
				segments,
				layouts: scope,
				render: assertRouteRender(value, routePath(segments)),
			});
			continue;
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Non-function route values are nested route objects.
		compileNode(value as Record<string, unknown>, [...prefix, ...parseKey(key)], scope, out);
	}
}

/** A `:...rest` segment swallows the remainder of the path, so nothing may follow it. */
function assertRestIsLast(segments: Segment[]): void {
	for (let i = 0; i < segments.length - 1; i++) {
		const segment = segments[i]!;
		if (segment.param && segment.rest) {
			throw new Error(`Catch-all segment ":...${segment.name}" must be the last path segment`);
		}
	}
}

/**
 * Static segments outrank matched params, which outrank plain params, which
 * outrank catch-alls — a segment that can turn a path down is more specific
 * than one that takes anything.
 */
function segmentRank(segment: Segment): number {
	if (!segment.param) return 0;
	const base = segment.rest ? 3 : 1;
	return segment.matcher === null ? base + 1 : base;
}

/** Static segments outrank params, and params outrank catch-alls, position by position. */
function compareRoutes(a: LeafRoute, b: LeafRoute): number {
	const length = Math.min(a.segments.length, b.segments.length);
	for (let i = 0; i < length; i++) {
		const difference = segmentRank(a.segments[i]!) - segmentRank(b.segments[i]!);
		if (difference !== 0) return difference;
	}
	return a.segments.length - b.segments.length;
}

function matchRoute(
	routes: readonly LeafRoute[],
	path: string,
	matchers: RouteMatchers,
): { route: LeafRoute; params: Record<string, unknown> } | null {
	const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
	for (const route of routes) {
		const last = route.segments[route.segments.length - 1];
		const hasRest = last !== undefined && last.param && last.rest;
		// a catch-all consumes one or more trailing segments; everything else is exact
		if (hasRest ? parts.length < route.segments.length : route.segments.length !== parts.length) {
			continue;
		}
		const params: Record<string, unknown> = {};
		let matched = true;
		for (let i = 0; i < route.segments.length; i++) {
			const segment = route.segments[i]!;
			if (!segment.param) {
				if (segment.value !== parts[i]) {
					matched = false;
					break;
				}
				continue;
			}
			const raw = segment.rest ? parts.slice(i).join("/") : parts[i]!;
			if (segment.matcher === null) {
				params[segment.name] = raw;
				continue;
			}
			// a matcher that turns the segment down does not fail the navigation:
			// a less specific route may still serve this path
			const value = matchers[segment.matcher]!.match(raw);
			if (value === mismatch) {
				matched = false;
				break;
			}
			params[segment.name] = value;
		}
		if (matched) return { route, params };
	}
	return null;
}

/**
 * A param value as the URL carries it. A matcher may parse a segment into
 * anything, but only something with an obvious spelling can be put back — so
 * an object that is not a `Date` says so here rather than becoming
 * `[object Object]` in a link.
 */
function paramText(value: unknown, name: string, path: string): string {
	switch (typeof value) {
		case "string":
			return value;
		case "number":
		case "bigint":
		case "boolean":
			return String(value);
		default:
			if (value instanceof Date) return value.toISOString();
			throw new Error(
				`Param "${name}" of "${path}" is a ${typeof value} — a URL segment needs a string, number, boolean, or Date`,
			);
	}
}

function buildHref(path: string, params: Record<string, unknown> = {}): string {
	const built = path
		.split("/")
		.map((part) => {
			if (!part.startsWith(":")) return part;
			const rest = part.startsWith(":...");
			const body = part.slice(rest ? 4 : 1);
			// `:id=integer` names the matcher gating the segment, not the param
			const equals = body.indexOf("=");
			const name = equals === -1 ? body : body.slice(0, equals);
			const value = params[name];
			if (value === undefined) {
				throw new Error(`Missing param "${name}" building href for "${path}"`);
			}
			const text = paramText(value, name, path);
			if (!rest) return encodeURIComponent(text);
			// a catch-all value spans segments: encode each, keep the slashes
			return text.split("/").filter(Boolean).map(encodeURIComponent).join("/");
		})
		.join("/");
	return built === "" ? "/" : built;
}

const FALLBACK = Symbol("router.fallback");

/**
 * A mounted router, as the hot-update seam below sees it: the path it is
 * currently showing, and a re-render of that match from a position in its
 * layout chain.
 */
type MountedRouter = {
	/** The path the router last matched, or `null` before its first match. */
	path: () => string | null;
	/**
	 * Re-render the current match from chain position `depth` (0 = outermost
	 * layout). `false` when there is no match to put back — the router is
	 * showing the fallback for a path its table has no route for.
	 */
	refresh: (depth: number) => boolean;
};

/** Every router currently mounted, so a hot update can find the live ones. */
const mountedRouters = new Set<MountedRouter>();

/**
 * Re-renders every mounted router at whatever depth `depthFor` picks for the
 * path that router is showing; `-1` leaves that router alone. Returns whether
 * any of them re-rendered.
 *
 * The seam a dev server drives when a route module is hot-replaced —
 * `@implementjs/kit` calls it from the `import.meta.hot.accept` it gives every
 * page and layout. Rebuilding from `depth` leaves everything above it mounted:
 * an edited page re-renders inside layouts that keep their DOM, their
 * subscriptions, and their state. Nothing outside HMR should need it.
 */
export function refreshRouters(depthFor: (path: string) => number): boolean {
	let refreshed = false;
	// a copy: a refresh that throws its way into the fallback can unmount a
	// router, and mutating the set mid-iteration would skip its neighbour
	const live = Array.from(mountedRouters);
	for (const router of live) {
		const path = router.path();
		if (path === null) continue;
		const depth = depthFor(path);
		if (depth < 0) continue;
		refreshed = router.refresh(depth) || refreshed;
	}
	return refreshed;
}

const NOT_FOUND: RouterError = { code: 404, message: "Not Found" };

/** A thrown `{ code, message }` passes through; anything else is a 500. */
function toRouterError(thrown: unknown): RouterError {
	if (
		typeof thrown === "object" &&
		thrown !== null &&
		"code" in thrown &&
		typeof thrown.code === "number" &&
		"message" in thrown &&
		typeof thrown.message === "string"
	) {
		return { code: thrown.code, message: thrown.message };
	}
	return { code: 500, message: thrown instanceof Error ? thrown.message : String(thrown) };
}

/**
 * A route-tree router. One nested object describes the whole app: keys are
 * path segments, `:param` segments surface as `Readable<string>`s at every
 * render below them, `"/"` renders a level, and `layout` wraps everything
 * beneath it (receiving the matched child). A path key may also map straight
 * to a handler — `"/about": () => About()` — shorthand for `{ "/": handler }`.
 * A trailing `:...rest` segment catches one or more remaining segments,
 * surfacing them joined with `/` (`/docs/:...slug` matches `/docs/a/b` with
 * `slug` = `"a/b"`); static segments outrank `:param`s, which outrank
 * catch-alls. A `:param=<name>` segment runs the named {@link RouteMatcher}
 * over the segment first: a value it turns down falls through to the next
 * route, and one it accepts is what the param carries — so a matcher that
 * parses gives the render a `Readable<number>` rather than a
 * `Readable<string>`. A `"(group)"` key nests a subtree (and its `layout`) without
 * contributing a path segment, so siblings can share a layout that the URL
 * never shows.
 *
 * The router is a `Mountable` — `app.render(router)` works, and so does
 * mounting one deep inside a layout. Navigating between children of a shared
 * layout swaps only the child; navigating between params of the same route
 * patches the param signals in place without remounting.
 *
 * ```ts
 * const router = Router({
 * 	"/": () => Home(),
 * 	"/about": () => About(),
 * 	"/issues": {
 * 		layout: (child) => Shell(child),
 * 		"/": () => Issues(),
 * 		"/:id": ({ id }) => Issue({ id }),
 * 	},
 * });
 * app.render(router);
 * router.Link({ to: "/issues/:id", params: { id: "42" } }, "Open #42");
 * ```
 */
export function Router<T extends Routes<T>>(
	routes: T,
	options: RouterOptions = {},
): RouterHelper<T> {
	const compiled: LeafRoute[] = [];
	compileNode(routes, [], [], compiled);
	compiled.sort(compareRoutes);
	const matchers = options.matchers ?? {};
	assertMatchersExist(compiled, matchers);

	const mountable = (): IMountable => {
		const root = Outlet();
		const paramSignals = new Map<string, Signal<unknown>>();
		const outlets: OutletHelper[] = [root];
		let chain: unknown[] = [];

		const paramsFor = (route: LeafRoute): RuntimeParams => {
			const params: RuntimeParams = {};
			for (const segment of route.segments) {
				if (segment.param) params[segment.name] = paramSignals.get(segment.name)!;
			}
			return params;
		};

		/** Content for chain position `index`, creating the outlets below it. */
		const build = (route: LeafRoute, index: number): Child => {
			const params = paramsFor(route);
			if (index < route.layouts.length) {
				const child = Outlet();
				outlets[index + 1] = child;
				const content = route.layouts[index]!.handler(child, params);
				child.set(build(route, index + 1));
				return content;
			}
			return route.render(params);
		};

		let shownError: RouterError | null = null;
		/** The match on screen, and the path it was matched from. */
		let current: LeafRoute | null = null;
		let currentPath: string | null = null;

		const showFallback = (error: RouterError) => {
			if (
				chain.length === 1 &&
				chain[0] === FALLBACK &&
				shownError !== null &&
				shownError.code === error.code &&
				shownError.message === error.message
			) {
				return;
			}
			chain = [FALLBACK];
			shownError = error;
			outlets.length = 1;
			root.set(options.fallback ? options.fallback(error) : null);
		};

		const onLocation = ({ path }: RouterLocation) => {
			const match = matchRoute(compiled, path, matchers);
			if (!match) {
				// nothing is on screen but the fallback, and no edit to a route
				// module can change that: `refresh` has nothing to put back
				current = null;
				currentPath = path;
				showFallback(NOT_FOUND);
				return;
			}

			for (const [name, value] of Object.entries(match.params)) {
				const existing = paramSignals.get(name);
				if (existing) {
					existing.set(value);
				} else {
					paramSignals.set(name, signal(value));
				}
			}
			for (const name of paramSignals.keys()) {
				if (!(name in match.params)) paramSignals.delete(name);
			}

			// recorded before the divergence check: a param-only change renders
			// nothing new, but it is still the path the router is showing
			current = match.route;
			currentPath = path;

			const next: unknown[] = [...match.route.layouts, match.route];
			let diverged = 0;
			while (
				diverged < chain.length &&
				diverged < next.length &&
				chain[diverged] === next[diverged]
			) {
				diverged++;
			}
			if (diverged === chain.length && diverged === next.length) return;

			chain = next;
			shownError = null;
			try {
				outlets[diverged]!.set(build(match.route, diverged));
				outlets.length = next.length;
			} catch (thrown) {
				(options.onError ?? console.error)(thrown);
				showFallback(toRouterError(thrown));
			}
		};

		/**
		 * Re-render the current match from chain position `depth`. The hot-update
		 * seam: `build` walks down from there, so the layouts above stay mounted
		 * and only what changed is torn down and rebuilt.
		 */
		const refresh = (depth: number): boolean => {
			const route = current;
			if (route === null || chain.length === 0) return false;
			// The fallback is not the match's chain, so it has no level to rebuild.
			// An edit landing while a render error is on screen is very likely the
			// fix for it, so the whole match goes back up and gets another try —
			// otherwise the error would sit there until the page was reloaded.
			const recovering = chain[0] === FALLBACK;
			const next: unknown[] = recovering ? [...route.layouts, route] : chain;
			const from = recovering ? 0 : Math.min(Math.max(depth, 0), next.length - 1);
			// the subtree leaves the document before its replacement enters, which
			// collapses the page height and clamps the scroll position with it — a
			// hot edit must not move the reader
			const { scrollX, scrollY } = window;
			try {
				const content = build(route, from);
				chain = next;
				shownError = null;
				outlets[from]!.set(content);
				outlets.length = next.length;
			} catch (thrown) {
				(options.onError ?? console.error)(thrown);
				showFallback(toRouterError(thrown));
				return true;
			}
			window.scrollTo(scrollX, scrollY);
			return true;
		};

		const handle: MountedRouter = { path: () => currentPath, refresh };

		// The whole router, in public parts: an effect that follows the location
		// for as long as the router is mounted, and the outlet the match renders
		// into. The effect mounts first, so the first match is already `set` by
		// the time the outlet puts it in the document.
		return ImplementLifecycle(
			{
				// registered from the document, not from construction: a mountable
				// built and never mounted must not sit in the set holding outlets
				// that no `set` can reach
				onMount() {
					mountedRouters.add(handle);
					return () => mountedRouters.delete(handle);
				},
				onUnmount() {
					chain = [];
					current = null;
					currentPath = null;
					outlets.length = 1;
					paramSignals.clear();
				},
			},
			ImplementEffect([location], onLocation),
			root,
		)();
	};

	const href = (path: string, params?: Record<string, unknown>) => buildHref(path, params);

	const navigate = (path: string, ...rest: unknown[]) => {
		const takesParams = path.includes(":");
		/* oxlint-disable typescript/no-unsafe-type-assertion -- Overloaded navigate rest args depend on whether the path has params. */
		const params = takesParams ? (rest[0] as Record<string, unknown>) : undefined;
		const navOptions = (takesParams ? rest[1] : rest[0]) as NavigateOptions | undefined;
		/* oxlint-enable typescript/no-unsafe-type-assertion */
		navigateTo(buildHref(path, params), navOptions);
	};

	const Link = (props: LinkProps<string>, ...children: Child[]): Mountable => {
		const { to, params, replace, noScroll, onClick, ...rest } = props;

		const record: Record<string, unknown> = params ?? {};
		const entries = Object.entries(record);
		const reactive = entries
			.map(([, value]) => value)
			.filter((value): value is Readable<unknown> => isReadable(value));
		const resolveParams = (): Record<string, unknown> =>
			Object.fromEntries(
				entries.map(([name, value]) => [name, isReadable(value) ? value.get() : value]),
			);
		const linkHref: string | Readable<string> =
			reactive.length === 0
				? buildHref(to, resolveParams())
				: derived(reactive, () => buildHref(to, resolveParams()));

		const currentHref = () => (typeof linkHref === "string" ? linkHref : linkHref.get());
		const hrefSignals = typeof linkHref === "string" ? [] : [linkHref];
		const ariaCurrent = derived([location, ...hrefSignals], (current) =>
			current.path === normalizePath(currentHref()) ? "page" : undefined,
		);

		return A(
			{
				...rest,
				href: linkHref,
				"aria-current": ariaCurrent,
				// says what the `onClick` below is about to do, for anything
				// outside that needs to know this click stays in the page
				[ROUTED_LINK_ATTRIBUTE]: "",
				onClick(event) {
					if (typeof onClick === "function") {
						onClick.call(this, event);
					}
					if (event.defaultPrevented) return;
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					if (event.button !== 0) return;
					const target = isReadable(rest.target) ? rest.target.get() : rest.target;
					if (target && target !== "_self") return;
					event.preventDefault();
					navigateTo(currentHref(), { replace, noScroll });
				},
			},
			...children,
		);
	};

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Router helper methods are merged onto the mountable return value.
	return Object.assign(mountable, {
		location,
		href,
		navigate,
		Link,
		searchParam,
	}) as unknown as RouterHelper<T>;
}
