import { derived, signal, type Readable, type Signal } from "../signal";

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
	if (serverSignal) return serverSignal;
	if (!current) {
		current = signal(readLocation());
		window.addEventListener("popstate", () => {
			current!.set(readLocation());
		});
	}
	return current;
}

export type NavigateOptions = {
	/** Replace the current history entry instead of pushing a new one. */
	replace?: boolean;
};

/** Push (or replace) a history entry and update the location signal. */
export function navigateTo(href: string, options: NavigateOptions = {}): void {
	if (serverSignal) {
		throw new Error(
			"navigateTo is not available during server rendering — render the target location instead",
		);
	}
	const url = new URL(href, window.location.href);
	if (url.href === window.location.href) return;
	if (options.replace) {
		history.replaceState(null, "", url);
	} else {
		history.pushState(null, "", url);
		window.scrollTo(0, 0);
	}
	locationSignal().set({
		path: normalizePath(url.pathname),
		search: url.search,
		hash: url.hash,
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
