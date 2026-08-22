import { derived, signal, type Readable, type Signal } from "../signal";
import {
	adoptPoppedEntry,
	captureScroll,
	commitEntry,
	currentEntryState,
	installScrollRestoration,
	newEntryState,
	restoreScroll,
	scrollToTop,
} from "./scroll";

export type RouterLocation = {
	/** Pathname with no trailing slash (the root is `"/"`). */
	path: string;
	/** Query string including the leading `?`, or `""`. */
	search: string;
	/** Fragment including the leading `#`, or `""`. */
	hash: string;
};

export function normalizePath(pathname: string): string {
	let path = pathname.startsWith("/") ? pathname : `/${pathname}`;
	while (path.length > 1 && path.endsWith("/")) {
		path = path.slice(0, -1);
	}
	return path;
}

function readLocation(): RouterLocation {
	return {
		path: normalizePath(window.location.pathname),
		search: window.location.search,
		hash: window.location.hash,
	};
}

let current: Signal<RouterLocation> | null = null;

let serverSignal: Signal<RouterLocation> | null = null;

let scopeSignal: Signal<RouterLocation> | null = null;

/**
 * Run `fn` with `location` installed as the location signal, so routers
 * mounted inside `fn` subscribe to it instead of the shared browser location.
 * Powers embedded previews (like the tutorial playground) that route without
 * touching the page URL — drive navigation afterwards by setting `location`.
 */
export function withLocationSignal<T>(location: Signal<RouterLocation>, fn: () => T): T {
	const previous = scopeSignal;
	scopeSignal = location;
	try {
		return fn();
	} finally {
		scopeSignal = previous;
	}
}

/**
 * Fixed location for the duration of a server render, shadowing the browser
 * singleton so nothing touches `window`. Returns a restore function.
 */
export function installServerLocation(location: RouterLocation): () => void {
	const previous = serverSignal;
	serverSignal = signal(location);
	return () => {
		serverSignal = previous;
	};
}

/** Lazy singleton so importing the router has no side effects until it is used. */
export function locationSignal(): Signal<RouterLocation> {
	if (scopeSignal) return scopeSignal;
	if (serverSignal) return serverSignal;
	if (!current) {
		current = signal(readLocation());
		installScrollRestoration();
		window.addEventListener("popstate", () => {
			const target = readLocation();
			if (!guardsAllow(target)) {
				// the history entry already moved — put the kept location back on top
				const kept = current!.get();
				history.pushState(newEntryState(), "", kept.path + kept.search + kept.hash);
				// the page never moved, so the entry that took its place owns
				// whatever the kept one was showing
				commitEntry();
				captureScroll();
				return;
			}
			captureScroll();
			adoptPoppedEntry(history.state);
			resolveNavigation(target, () => {
				current!.set(target);
				commitEntry();
				// after the commit: the destination has to be in the DOM before
				// the page is tall enough to scroll back down it
				restoreScroll();
			});
		});
	}
	return current;
}

/**
 * True while routing drives the real page URL, rather than a server render or
 * a {@link withLocationSignal} scope — the two cases that must not touch the
 * document's history or scroll position.
 */
export function isPageLocation(): boolean {
	return scopeSignal === null && serverSignal === null;
}

/**
 * Runs before a navigation is attempted; returning `false` cancels it — the
 * location signal never updates and (for `navigateTo`) no history entry is
 * pushed. Guards are synchronous so they can wrap `confirm()`-style prompts
 * ("you have unsaved edits — leave anyway?"). They only cover in-app
 * navigation; pair one with a `beforeunload` listener for refresh/close.
 */
export type NavigationGuard = (to: RouterLocation) => boolean;

const navigationGuards = new Set<NavigationGuard>();

/** Install a {@link NavigationGuard}; returns its unregister function. */
export function registerNavigationGuard(guard: NavigationGuard): () => void {
	navigationGuards.add(guard);
	return () => {
		navigationGuards.delete(guard);
	};
}

function guardsAllow(target: RouterLocation): boolean {
	for (const guard of navigationGuards) {
		if (!guard(target)) return false;
	}
	return true;
}

/**
 * Runs before a navigation commits (before the history entry and the location
 * signal update), so integrations can resolve what the destination needs —
 * kit uses this to fetch route data. Returning a promise delays the commit
 * until it resolves; a rejection cancels the navigation.
 */
export type NavigationResolver = (to: RouterLocation) => void | Promise<void>;

let navigationResolver: NavigationResolver | null = null;

/** Install the {@link NavigationResolver} (`null` removes it). Last one wins. */
export function setNavigationResolver(resolver: NavigationResolver | null): void {
	navigationResolver = resolver;
}

let navigationToken = 0;

/** Runs the resolver (if any) and commits — only if no newer navigation started meanwhile. */
function resolveNavigation(target: RouterLocation, commit: () => void): void {
	const token = ++navigationToken;
	if (navigationResolver === null) {
		commit();
		return;
	}
	let result;
	try {
		result = navigationResolver(target);
	} catch (error) {
		console.error(error);
		return;
	}
	if (result instanceof Promise) {
		result.then(
			() => {
				if (token === navigationToken) commit();
			},
			(error) => console.error(error),
		);
	} else {
		commit();
	}
}

export type NavigateOptions = {
	/** Replace the current history entry instead of pushing a new one. */
	replace?: boolean;
	/**
	 * Skip the scroll to the top that a push does, staying where the page is —
	 * what a filter link wants, rather than jumping a long list back to the
	 * top. A `replace` rewrites the URL of the page the user is already
	 * reading and never scrolls, so this changes nothing there; back and
	 * forward restore the position they recorded.
	 */
	noScroll?: boolean;
};

/** Push (or replace) a history entry and update the location signal. */
export function navigateTo(href: string, options: NavigateOptions = {}): void {
	if (serverSignal) {
		throw new Error(
			"navigateTo is not available during server rendering — render the target location instead",
		);
	}
	// resolved up front: it installs scroll restoration before the first entry
	// this pushes, and a resolver that awaits must not commit into whatever
	// scope happens to be installed by the time it comes back
	const location = locationSignal();
	const url = new URL(href, window.location.href);
	if (url.href === window.location.href) return;
	const target: RouterLocation = {
		path: normalizePath(url.pathname),
		search: url.search,
		hash: url.hash,
	};
	if (!guardsAllow(target)) return;
	// the history entry waits alongside the signal, so the URL never shows a
	// destination whose data has not resolved yet
	resolveNavigation(target, () => {
		if (options.replace) {
			history.replaceState(currentEntryState(), "", url);
		} else {
			captureScroll();
			history.pushState(newEntryState(), "", url);
		}
		location.set(target);
		commitEntry();
		if (!options.replace && !options.noScroll) scrollToTop();
	});
}

export type SearchParam<T extends string | null> = Readable<T> & {
	/** Write the value into the URL, replacing the current history entry. `null` removes it. */
	set(value: T | null): void;
};

/**
 * A URL-synced query-string value. Reads react to navigation; `set` rewrites
 * the query string in place (history `replace`), so binding one to an input
 * makes a URL-synced search box. With a `fallback` the value is never `null`,
 * and setting the fallback removes the parameter from the URL.
 */
export function searchParam(name: string): SearchParam<string | null>;
export function searchParam(name: string, fallback: string): SearchParam<string>;
export function searchParam(name: string, fallback?: string): SearchParam<string | null> {
	const location = locationSignal();
	const inner = derived([location], ({ search }) => {
		const value = new URLSearchParams(search).get(name);
		return value ?? fallback ?? null;
	});

	return {
		get: () => inner.get(),
		subscribe: (callback) => inner.subscribe(callback),
		onChange: (callback) => inner.onChange(callback),
		bind: (selector: never) => inner.bind(selector),
		set(value: string | null) {
			if (serverSignal) {
				throw new Error(
					"searchParam.set is not available during server rendering — render the target location instead",
				);
			}
			const url = new URL(window.location.href);
			if (value == null || value === "" || value === fallback) {
				url.searchParams.delete(name);
			} else {
				url.searchParams.set(name, value);
			}
			navigateTo(url.pathname + url.search + url.hash, { replace: true });
		},
	};
}
