import {
	derived,
	setNavigationResolver,
	signal,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { preloadRoute } from "./lazy.ts";
import { dataPath, matchRoutePattern, normalizeRoutePath, type RouteData } from "./match.ts";
import { appMatchers, registerMatchers } from "./params.ts";

export { lazyModule, preloadRoute, registerRouteModules, type ModuleHandle } from "./lazy.ts";

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
	matchPage,
	matchRoutePattern,
	routeId,
	runLoads,
	type EndpointMatch,
	type EndpointRoute,
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
 * receive, and the client-side navigation hook that fetches a route's data
 * before it renders. The generated `$implement/router` module and
 * `.implement/` entries wire it up — apps normally never import it directly.
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

/** Fetch and seed the destination's `__data.json`; no-op for a route with no loads. */
async function fetchRouteData(path: string): Promise<void> {
	const matchers = appMatchers();
	const route = clientRoutes.find(
		(entry) => matchRoutePattern(entry.pattern, path, matchers) !== null,
	);
	if (route === undefined) return;
	const response = await fetch(dataPath(path));
	if (!response.ok) throw new Error(`fetching route data failed: ${response.status}`);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Route data JSON matches the generated load module shape.
	seedData((await response.json()) as RouteData);
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
			await Promise.all([preloadRoute(to.path), fetchRouteData(to.path)]);
		} catch (error) {
			// a data fetch that failed, or a route chunk that is gone because
			// the site was redeployed under this tab — either way the app
			// cannot render the destination, so let the browser fetch it
			window.location.assign(to.path + to.search + to.hash);
			throw error;
		}
	});
}
