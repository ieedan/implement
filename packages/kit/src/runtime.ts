import {
	derived,
	Outlet,
	setNavigationResolver,
	signal,
	type Child,
	type Readable,
	type Signal,
} from "@implementjs/core";
import type { RouterError } from "@implementjs/router";
import { errorBoundaryFor, preloadRoute } from "./lazy.ts";
import { dataPath, matchRoutePattern, normalizeRoutePath, type RouteData } from "./match.ts";
import { appMatchers, registerMatchers } from "./params.ts";

export {
	errorBoundaryFor,
	hotReplaceRoute,
	lazyModule,
	preloadErrorRoute,
	preloadRoute,
	registerErrorRoutes,
	registerRouteModules,
	type ErrorBoundary,
	type ModuleHandle,
} from "./lazy.ts";

export { registerMatchers };

export {
	appMatchers,
	isParamMatcher,
	matcher,
	matcherTable,
	mismatch,
	type AnyParamMatcher,
	type ParamMatcher,
	type ParamMatchers,
	type ParamType,
} from "./params.ts";

export {
	comparePatterns,
	dataPath,
	matchEndpoint,
	matchErrorRoute,
	matchPage,
	matchRoutePattern,
	routeId,
	runLoads,
	type EndpointMatch,
	type EndpointRoute,
	type ErrorRoute,
	type LoadEvent,
	type PageMatch,
	type PageRoute,
	type RequestEvent,
	type RequestHandler,
	type RouteData,
	type ServerLoad,
} from "./match.ts";

/**
 * The browser- and server-render half of kit's server data: a store of what
 * each `*.server.ts` load returned, the `data` readables pages and layouts
 * receive, the client-side navigation hook that fetches a route's data before
 * it renders, and `invalidate` / `invalidateAll`, which run that same fetch on
 * demand. The generated `$implement/router` module and `.implement/` entries
 * wire it up — apps reach the invalidation half through
 * `$implement/navigation` and never import this directly.
 */

const store = new Map<string, Signal<unknown>>();

function fileData(id: string): Signal<unknown> {
	let entry = store.get(id);
	if (entry === undefined) {
		entry = signal<unknown>({});
		store.set(id, entry);
	}
	return entry;
}

/** Store load results, notifying any mounted `data` readables. */
export function seedData(data: RouteData): void {
	for (const [id, value] of Object.entries(data)) {
		fileData(id).set(value ?? {});
	}
}

/**
 * The `data` readable for a route: the stored results of its server files,
 * merged root-first (a page's own load wins over its layouts'). Stays live —
 * navigating between params of one route reseeds the store and the readable
 * updates in place, matching how `params` behave.
 */
export function routeData(files: string[]): Readable<RouteData> {
	return derived(files.map(fileData), (...values) => Object.assign({}, ...values));
}

type ClientRoute = { pattern: string; files: string[] };

let clientRoutes: ClientRoute[] = [];

/** Called by the generated router module with the routes that have loads. */
export function registerRoutes(routes: ClientRoute[]): void {
	clientRoutes = routes;
}

/**
 * Run a path's loads on the server and hand back what they returned, or `null`
 * for a route with no loads. This is the `__data.json` endpoint — the same one
 * a navigation goes through, and the same `runLoads` behind it — which is why
 * invalidating reuses it rather than having a path of its own.
 *
 * The query string comes along: the pipeline rebuilds `event.url` from it, so
 * a load reading `url.searchParams` sees what the page it is rendering for
 * was asked with.
 */
async function loadRouteData(path: string, search: string): Promise<RouteData | null> {
	const matchers = appMatchers();
	const route = clientRoutes.find(
		(entry) => matchRoutePattern(entry.pattern, path, matchers) !== null,
	);
	if (route === undefined) return null;
	const response = await fetch(`${dataPath(path)}${search}`);
	if (!response.ok) throw new Error(`fetching route data failed: ${response.status}`);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Route data JSON matches the generated load module shape.
	return (await response.json()) as RouteData;
}

/** Fetch and seed the destination's `__data.json`; no-op for a route with no loads. */
async function fetchRouteData(path: string, search: string): Promise<void> {
	const data = await loadRouteData(path, search);
	if (data !== null) seedData(data);
}

/**
 * Which invalidation is the newest. Two of them in flight at once is a mutation
 * answered twice, and the older answer is the stale one however the network
 * ordered them — so it is dropped rather than seeded over the newer one.
 */
let invalidation = 0;

/**
 * Whether `route` names a route that feeds the page at `path`: the page itself,
 * or a layout above it. Both are patterns — `/app/:slug/inbox` — and a concrete
 * path is a pattern that binds nothing, so either form works.
 *
 * A layout is named by its own route, and it is reached by walking `path` up:
 * `/app/:slug` covers `/app/acme/issue/12`, which is what lets a page say the
 * unread count in the shell around it has gone stale.
 */
function routeCovers(route: string, path: string): boolean {
	const matchers = appMatchers();
	const pattern = normalizeRoutePath(route);
	for (let candidate = path; ; candidate = parentPath(candidate)) {
		if (matchRoutePattern(pattern, candidate, matchers) !== null) return true;
		if (candidate === "/") return false;
	}
}

function parentPath(path: string): string {
	const cut = path.lastIndexOf("/");
	return cut <= 0 ? "/" : path.slice(0, cut);
}

/**
 * Re-run the loads feeding the page on screen and reseed `data` with what they
 * return — kit's answer to "that data is stale now".
 *
 * ```ts
 * await api.PATCH("/api/issues/[id]", { params: { id }, body: { done: true } });
 * await invalidate();
 * ```
 *
 * The data goes back into the same per-file store a navigation seeds, so a
 * component holding `data` — or anything derived from it — sees the new value
 * where it stands. Nothing remounts and nothing is patched by hand.
 *
 * With a `route` argument, the loads only re-run when that route is part of
 * what is rendered: the current page's own route, or a layout above it. That
 * is how a page invalidates the shell around it (`invalidate("/app/:slug")`)
 * without every mutation anywhere re-running every load in the app.
 *
 * Resolves once the new data is seeded. A no-op on the server, where the loads
 * have only just run for the render in progress.
 */
export async function invalidate(route?: string): Promise<void> {
	if (typeof window === "undefined") return;
	const path = normalizeRoutePath(window.location.pathname);
	if (route !== undefined && !routeCovers(route, path)) return;
	const token = ++invalidation;
	const data = await loadRouteData(path, window.location.search);
	// a newer invalidation, or a navigation onto another route, has already
	// answered for this page — seeding now would put back what it replaced
	if (data === null || token !== invalidation) return;
	if (normalizeRoutePath(window.location.pathname) !== path) return;
	seedData(data);
}

/**
 * Re-run every load feeding the page on screen — {@link invalidate} with
 * nothing to narrow it.
 *
 * Kit keys load data by the server file that produced it, and one route's
 * chain is live at a time, so "all of them" and "the current route's" are the
 * same set. The two names exist because the distinction is worth keeping at
 * the call site: `invalidate("/app/:slug")` says which data went stale, and
 * `invalidateAll()` says you would rather not think about it.
 */
export function invalidateAll(): Promise<void> {
	return invalidate();
}

/**
 * The error page for a path, rendered inside the layouts around it: the
 * deepest `error.ts` the path falls inside, wrapped in that directory's layout
 * chain. `null` when the app declares no `error.ts` covering the path, which is
 * a request kit answers in plain text rather than with a page.
 *
 * This is what the router's fallback renders, and what the server entry renders
 * for a thrown error — where there is no router match to fall back through. The
 * layouts are the ones the boundary's own directory renders in, so a 404 deep
 * inside a section keeps the section's shell instead of replacing the document
 * with a bare message.
 *
 * The layout chunks have to be loaded first, which {@link preloadRoute} does
 * for a path no route serves; the layouts hand their `children` down through an
 * `Outlet` exactly as the router does, so what mounts inside one is what would
 * have mounted there anyway.
 */
export function renderErrorPage(error: RouterError, path: string): Child | null {
	const match = errorBoundaryFor(path);
	if (match === null) return null;
	// the directory's own params, as the readables a layout renders `params.slug`
	// from — the boundary matched the path, so they are the section's real ones
	const params = Object.fromEntries(
		Object.entries(match.params).map(([name, value]) => [name, signal(value)]),
	);
	let child: Child = match.route.page(error);
	for (let i = match.route.layouts.length - 1; i >= 0; i--) {
		child = match.route.layouts[i]!(Outlet(child), params);
	}
	return child;
}

/**
 * Called by the generated client entry: seeds the store from the data the
 * server render embedded in the page, then installs the navigation resolver
 * that resolves everything the destination needs before a navigation commits —
 * its route chunks and its `__data.json`. If either fails the navigation falls
 * back to a full document load.
 */
export function initClientData(): void {
	const embedded = document.querySelector("script[data-implement-data]");
	// An HMR update re-runs the entry against a store that already holds the
	// data for wherever the app navigated to; re-seeding there would put the
	// landing page's payload back and re-render every route with it.
	if (embedded?.textContent && store.size === 0) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Embedded route data is JSON serialized at build time.
		seedData(JSON.parse(embedded.textContent) as RouteData);
	}
	setNavigationResolver(async (to) => {
		// same-path navigations (query, hash) render what is already loaded
		if (to.path === normalizeRoutePath(window.location.pathname)) return;
		try {
			// concurrently: the code and the data are independent fetches, and
			// sequencing them would put two round trips in front of every
			// navigation instead of one
			await Promise.all([preloadRoute(to.path), fetchRouteData(to.path, to.search)]);
		} catch (error) {
			// a data fetch that failed, or a route chunk that is gone because
			// the site was redeployed under this tab — either way the app
			// cannot render the destination, so let the browser fetch it
			window.location.assign(to.path + to.search + to.hash);
			throw error;
		}
	});
}
