import { comparePatterns, matchRoutePattern, normalizeRoutePath } from "./match.ts";

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
};

/** Every handle the generated router module declared, by module id. */
const handles = new Map<string, ModuleHandle<unknown>>();

/**
 * Declares a lazily loaded route module. `id` is the module's root-relative
 * path (`src/routes/docs/index.ts`) — the key the route manifest below refers
 * to, and the same key Vite's build manifest uses, so the preload-hint pass
 * can look the two up against each other.
 */
export function lazyModule<T>(
	id: string,
	importer: () => Promise<{ default: T }>,
): ModuleHandle<T> {
	// boxed, so a module whose default export is nullish still counts as loaded
	let resolved: { value: T } | null = null;
	let loading: Promise<void> | null = null;
	const handle: ModuleHandle<T> = {
		load() {
			if (resolved !== null) return Promise.resolve();
			loading ??= importer().then(
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
		get() {
			if (resolved === null) {
				throw new Error(
					`route module "${id}" rendered before it loaded — this render path is missing its preloadRoute`,
				);
			}
			return resolved.value;
		},
	};
	// the router module re-declares its handles on an HMR reload; newest wins
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
 * No-ops for a path matching no registered route. The navigation resolver this
 * runs from is a process-wide singleton, so it also sees the paths of embedded
 * routers driven through `withLocationSignal` — those have nothing to do with
 * the app's own route tree and must pass through untouched. The data resolver
 * already behaves this way.
 */
export async function preloadRoute(url: string): Promise<void> {
	const path = normalizeRoutePath(new URL(url, "http://implement.internal").pathname);
	const route = moduleRoutes.find((entry) => matchRoutePattern(entry.pattern, path) !== null);
	if (route === undefined) return;
	await Promise.all(route.modules.map((id) => handleFor(id).load()));
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
