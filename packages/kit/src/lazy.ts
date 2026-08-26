import type { Child, Mountable, Readable } from "@implementjs/core";
import { refreshRouters, type RouterError } from "@implementjs/router";
import {
	comparePatterns,
	matchErrorRoute,
	matchRoutePattern,
	normalizeRoutePath,
} from "./match.ts";
import { appMatchers } from "./params.ts";

/**
 * Route code-splitting: the generated router module declares a handle per page
 * and layout instead of importing them, and asks the handle for the component
 * when the route renders. `load()` pulls the chunk in, `get()` hands back the
 * default export it resolved to.
 *
 * Route factories stay synchronous, and that is the whole design. A tree of
 * promise-returning factories would have to be awaited wherever a route
 * renders — including the re-renders a param change triggers — so instead the
 * three places that can *start* a render preload the destination's modules
 * first: the client entry for the landing route, the navigation resolver for
 * the destination, and the server entry for the route it is rendering.
 * `get()` throws if one of them ever forgets, which is the contract: if that
 * error surfaces, a render path is missing its {@link preloadRoute}.
 */

export type ModuleHandle<T> = {
	/** Pull the module in, joining a load already in flight. Idempotent. */
	load(): Promise<void>;
	/** The module's default export. Throws unless {@link load} has resolved. */
	get(): T;
	/**
	 * Swap what {@link get} hands back, without importing anything. The dev
	 * server's seam — see {@link hotReplaceRoute} — for a module Vite has
	 * already re-evaluated and handed over.
	 */
	replace(value: T): void;
	/**
	 * Point the handle at a newer import of the same module, for a route not
	 * loaded yet. What is already loaded stays loaded: only {@link replace}
	 * moves that. See {@link lazyModule} for who calls this and why.
	 */
	rebind(importer: () => Promise<{ default: T }>): void;
};

/** Every handle the generated router module declared, by module id. */
const handles = new Map<string, ModuleHandle<unknown>>();

/**
 * Declares a lazily loaded route module. `id` is the module's root-relative
 * path (`src/routes/docs/page.ts`) — the key the route manifest below refers
 * to, and the same key Vite's build manifest uses, so the preload-hint pass
 * can look the two up against each other.
 */
export function lazyModule<T>(
	id: string,
	importer: () => Promise<{ default: T }>,
): ModuleHandle<T> {
	// One handle per module id, for the life of the page. The generated router
	// module re-evaluates whenever anything it imports does — a view that
	// imports `router` for a `Link` puts the router module back in the chain of
	// its own hot update — and a second handle would strand the first: the
	// mounted router closed over it when it built its route table, so a hot
	// replace against the newcomer swaps a component nothing is rendering,
	// and the page keeps showing the code you just edited away.
	const existing = handles.get(id);
	if (existing !== undefined) {
		// the map is keyed by module id, and a module has one default export;
		// the handle for this id is this id's handle whatever T the caller names
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- One handle per module id, so its T is this call's T.
		const typed = existing as ModuleHandle<T>;
		typed.rebind(importer);
		return typed;
	}
	// boxed, so a module whose default export is nullish still counts as loaded
	let resolved: { value: T } | null = null;
	let loading: Promise<void> | null = null;
	let load = importer;
	const handle: ModuleHandle<T> = {
		load() {
			if (resolved !== null) return Promise.resolve();
			loading ??= load().then(
				(module) => {
					resolved = { value: module.default };
					loading = null;
				},
				(error: unknown) => {
					// a failed import must not poison the handle — a retry (or the
					// full document load the navigation resolver falls back to)
					// gets a fresh attempt at the chunk
					loading = null;
					throw error;
				},
			);
			return loading;
		},
		replace(value: T) {
			resolved = { value };
			// an import still in flight would overwrite the replacement when it
			// lands, putting the pre-edit module back
			loading = null;
		},
		rebind(next: () => Promise<{ default: T }>) {
			// only the not-yet-loaded case can use it, and only the not-yet-loaded
			// case should: a fresh importer carries the newest URL for the chunk
			if (resolved === null && loading === null) load = next;
		},
		get() {
			if (resolved === null) {
				throw new Error(
					`route module "${id}" rendered before it loaded — this render path is missing its preloadRoute`,
				);
			}
			return resolved.value;
		},
	};
	handles.set(id, handle);
	return handle;
}

/** A route and the module ids it renders through. */
type ModuleRoute = { pattern: string; modules: string[] };

let moduleRoutes: ModuleRoute[] = [];

/** Called by the generated router module with every route's module ids. */
export function registerRouteModules(routes: ModuleRoute[]): void {
	// most specific first, so `/users/new` preloads its own page rather than
	// `/users/:id`'s — the ordering `resolveLoads` already applies server-side
	moduleRoutes = routes.toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
}

/**
 * Loads the modules the route serving `url` renders through: its page and the
 * layouts that actually wrap it. Rejects if a chunk fails to load.
 *
 * For a path no route serves, that is the layouts around the nearest
 * `error.ts` instead — what renders a 404 there. No-ops when neither covers
 * it. The navigation resolver this runs from is a process-wide singleton, so it
 * also sees the paths of embedded routers driven through `withLocationSignal`
 * — those have nothing to do with the app's own route tree and must pass
 * through untouched. The data resolver already behaves this way.
 */
export async function preloadRoute(url: string): Promise<void> {
	const path = pathOf(url);
	// the real matchers, not `"structure"`: preloading the chunks of a route a
	// matcher would turn down leaves the route that does serve the path without
	// its modules, and the render is synchronous
	const matchers = appMatchers();
	const route = moduleRoutes.find(
		(entry) => matchRoutePattern(entry.pattern, path, matchers) !== null,
	);
	// nothing serves this path, so what renders it is the nearest error page.
	// Handled here rather than at the call sites, so every render path that
	// preloads a destination already preloads what a 404 there would need
	if (route === undefined) return await preloadErrorRoute(path);
	await Promise.all(route.modules.map((id) => handleFor(id).load()));
}

function pathOf(url: string): string {
	return normalizeRoutePath(new URL(url, "http://implement.internal").pathname);
}

/**
 * An `error.ts` and what renders around it, as the generated router module
 * declares it: the pattern of the directory the boundary covers, the layouts
 * wrapping it (outermost first, in the `(children, params)` form the router
 * calls a layout with), and the error page itself.
 */
export type ErrorBoundary = {
	pattern: string;
	/** Module ids of those layouts — what a render path has to have in memory first. */
	modules: string[];
	layouts: ((children: Mountable, params: Record<string, Readable<unknown>>) => Child)[];
	page: (error: RouterError) => Child;
};

let errorBoundaries: ErrorBoundary[] = [];

/** Called by the generated router module with every `error.ts` in the app. */
export function registerErrorRoutes(boundaries: ErrorBoundary[]): void {
	errorBoundaries = boundaries;
}

/**
 * The nearest `error.ts` above a path, with the params its directory binds —
 * the deepest boundary the path falls inside, and `null` when the app declares
 * none that covers it.
 */
export function errorBoundaryFor(
	path: string,
): { route: ErrorBoundary; params: Record<string, unknown> } | null {
	return matchErrorRoute(errorBoundaries, normalizeRoutePath(path), appMatchers());
}

/**
 * Loads the layouts wrapping the nearest `error.ts` above a path — what an
 * error page renders inside, and so what has to be in memory before one
 * renders. No-ops when no boundary covers the path.
 */
export async function preloadErrorRoute(url: string): Promise<void> {
	const match = errorBoundaryFor(pathOf(url));
	if (match === null) return;
	await Promise.all(match.route.modules.map((id) => handleFor(id).load()));
}

function handleFor(id: string): ModuleHandle<unknown> {
	const handle = handles.get(id);
	if (handle === undefined) {
		// only reachable if the manifest and the handle declarations disagree,
		// which would mean the codegen emitted them out of step
		throw new Error(`no route module declared for "${id}"`);
	}
	return handle;
}

/**
 * Hot-replaces one page or layout with the module Vite just re-evaluated, and
 * re-renders the routers showing it.
 *
 * Every page and layout accepts its own updates in dev — the plugin appends
 * the `import.meta.hot.accept` that calls this — so a route module is where an
 * edit stops climbing the import graph. The handle behind it swaps in place,
 * which is what makes the re-render possible at all: the generated router
 * module's route table closed over these handles when it ran, and it is not
 * running again.
 *
 * The re-render starts at the module's own position in the route's chain
 * (`layouts…, page`, the order {@link registerRouteModules} records), so
 * everything above it stays mounted with its state: an edited page re-renders
 * inside layouts that never blinked, and an edited layout keeps its ancestors.
 * A module that is not part of the route on screen updates its handle and
 * renders nothing — the next navigation into it gets the new code.
 *
 * Returns `false` only when no handle is declared for `id`, which means the
 * route tree moved under the running router; the caller reloads.
 */
export function hotReplaceRoute(id: string, value: unknown): boolean {
	const handle = handles.get(id);
	if (handle === undefined) return false;
	handle.replace(value);
	const matchers = appMatchers();
	refreshRouters((path) => {
		const route = moduleRoutes.find(
			(entry) => matchRoutePattern(entry.pattern, path, matchers) !== null,
		);
		return route === undefined ? -1 : route.modules.indexOf(id);
	});
	return true;
}
