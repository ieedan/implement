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

export {
	hotReplaceRoute,
	lazyModule,
	preloadRoute,
	registerRouteModules,
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
 *
 * The exception is {@link preloadCode} and {@link preloadData}, which an app
 * calls to warm a route ahead of a navigation. They are re-exported as
 * `@implementjs/kit/navigation`, which is the spelling app code should use.
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

/** Whether the route serving `path` has any loads to fetch data for. */
function hasLoads(path: string): boolean {
	const matchers = appMatchers();
	return clientRoutes.some((entry) => matchRoutePattern(entry.pattern, path, matchers) !== null);
}

/** One request for a route's serialized load results. */
async function requestRouteData(path: string): Promise<RouteData> {
	const response = await fetch(dataPath(path));
	if (!response.ok) throw new Error(`fetching route data failed: ${response.status}`);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Route data JSON matches the generated load module shape.
	return (await response.json()) as RouteData;
}

/**
 * How long a preloaded payload stays usable, in milliseconds.
 *
 * A preload is a guess that the reader is about to follow the link, and the
 * value of the guess decays: the click it was for lands within a second or
 * two, while the pointer that crossed a link and moved on leaves a payload
 * that is only going to get staler. Serving that to a navigation minutes
 * later would make preloading a correctness change rather than a speed one —
 * so an entry that was not spent expires, and the navigation fetches fresh.
 */
const PRELOAD_TTL = 30_000;

/** A preloaded payload and the moment it stops being worth serving. */
type Preloaded = { data: Promise<RouteData>; expires: number };

/**
 * Route data fetched ahead of a navigation, by path.
 *
 * Deliberately *not* {@link seedData}: seeding is what makes the mounted
 * `data` readables update, so a hover that seeded would re-render the page
 * the reader is still looking at with the destination's data. The payload
 * waits here instead, and the navigation resolver spends it on the way
 * through.
 */
const preloaded = new Map<string, Preloaded>();

/** The unspent, unexpired entry for `path`, dropping it if it has gone stale. */
function livePreload(path: string): Promise<RouteData> | undefined {
	const entry = preloaded.get(path);
	if (entry === undefined) return undefined;
	if (entry.expires > Date.now()) return entry.data;
	preloaded.delete(path);
	return undefined;
}

/** Drop everything past its TTL, so a page of hovered links does not accumulate. */
function sweepPreloads(): void {
	const now = Date.now();
	for (const [path, entry] of preloaded) {
		if (entry.expires <= now) preloaded.delete(path);
	}
}

/**
 * Loads the code the route serving `href` renders through, without waiting for
 * anything else — the cheap half of a preload, and the whole of it for a route
 * with no loads.
 *
 * ```ts
 * import { preloadCode } from "@implementjs/kit/navigation";
 *
 * Button({ onMouseEnter: () => void preloadCode("/checkout") }, "Checkout");
 * ```
 *
 * A path matching no route in the app resolves without doing anything.
 * Rejects if a chunk fails to load.
 */
export function preloadCode(...hrefs: string[]): Promise<void> {
	return Promise.all(hrefs.map((href) => preloadRoute(href))).then(() => undefined);
}

/**
 * Everything a navigation to `href` needs, fetched now rather than on the
 * click: the route's chunks *and* its `__data.json`. The payload is held for
 * {@link PRELOAD_TTL} and spent by the next navigation there, which then
 * commits without a round trip of its own.
 *
 * ```ts
 * import { preloadData } from "@implementjs/kit/navigation";
 *
 * A({ href: "/orders/1", onMouseEnter: () => void preloadData("/orders/1") }, "Order #1");
 * ```
 *
 * Most apps never call this — the `data-implement-preload-data` attribute
 * does it for links on hover or tap. Reach for it when what predicts the
 * navigation is not a pointer over an `<a>`: a wizard warming its next step,
 * a list row that opens on double click.
 *
 * Resolves with the data it fetched, or `null` for a route with no loads (the
 * code is still preloaded). Rejects if the fetch or a chunk fails; a caller
 * with nothing to do about that can ignore the rejection, since the
 * navigation itself will try again and fall back to a full document load.
 */
export async function preloadData(href: string): Promise<RouteData | null> {
	const path = normalizeRoutePath(new URL(href, window.location.href).pathname);
	// the code first: a route with no loads has nothing else to preload, and
	// one with loads wants both fetches in flight together anyway
	const code = preloadRoute(path);
	if (!hasLoads(path)) {
		await code;
		return null;
	}
	const live = livePreload(path);
	if (live !== undefined) {
		// a second hover over a link already warmed joins the first fetch
		// rather than starting another
		await code;
		return live;
	}
	sweepPreloads();
	const data = requestRouteData(path);
	preloaded.set(path, { data, expires: Date.now() + PRELOAD_TTL });
	// a failed preload must not sit in the map poisoning the navigation that
	// follows — that one deserves its own attempt, and its own fallback
	data.catch(() => {
		if (preloaded.get(path)?.data === data) preloaded.delete(path);
	});
	const [, resolved] = await Promise.all([code, data]);
	return resolved;
}

/**
 * Seed the destination's `__data.json`, spending a preload if one is waiting;
 * no-op for a route with no loads.
 */
async function fetchRouteData(path: string): Promise<void> {
	if (!hasLoads(path)) return;
	const preload = livePreload(path);
	// spent either way: what it holds is about to be in the store, and holding
	// it past that is holding a copy that only gets staler
	preloaded.delete(path);
	seedData(await (preload ?? requestRouteData(path)));
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
