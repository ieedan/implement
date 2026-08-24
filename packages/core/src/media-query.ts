import { isHydrating } from "./hydration";
import { LazyReadable, type Readable } from "./signal";
import type { Unsubscribe } from "./types";

export type MediaQueryOptions = {
	/**
	 * What to report where there is no viewport to ask. Defaults to `false`.
	 *
	 * This is the server's answer, and so also the answer during hydration: the
	 * markup being adopted was rendered against it, and a render that disagreed
	 * would be thrown out and done again. Pick the layout worth prerendering.
	 */
	fallback?: boolean;
};

/** Shared do-nothing unsubscribe, for the server and for browsers without matchMedia. */
const noop = (): void => {};

class MediaQuery extends LazyReadable<boolean> {
	constructor(
		private readonly query: string,
		private readonly fallback: boolean,
	) {
		super();
		this.value = this.read();
	}

	private list(): MediaQueryList | null {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
		return window.matchMedia(this.query);
	}

	protected read(): boolean {
		const list = this.list();
		if (list === null) return this.fallback;
		// the server had no viewport, so the markup being hydrated was rendered
		// against the fallback. Answering honestly here is what produces the
		// mismatch; `watch` delivers the real value once the pass is over.
		if (isHydrating()) return this.fallback;
		return list.matches;
	}

	protected watch(onValue: (value: boolean) => void): Unsubscribe {
		const list = this.list();
		if (list === null) return noop;

		const listener = () => onValue(list.matches);
		list.addEventListener("change", listener);

		// Hydration is one synchronous pass, so by the time a microtask queued
		// during it runs, it is over — which is where a value held back to match
		// the server catches up. Outside hydration this reports what `read`
		// already returned, and `LazyReadable` drops it as unchanged.
		let stopped = false;
		queueMicrotask(() => {
			if (stopped) return;
			onValue(list.matches);
		});

		return () => {
			stopped = true;
			list.removeEventListener("change", listener);
		};
	}
}

/**
 * A CSS media query as a readable. True while the query matches, and it
 * updates when that changes — so a layout can branch on the viewport the same
 * way it branches on any other signal.
 *
 * ```ts
 * const isMobile = mediaQuery("(max-width: 767px)");
 *
 * If(isMobile).Then(DrawerContent(...)).Else(DialogContent(...));
 * ```
 *
 * It listens only while something is listening to it, so one declared at
 * module scope and imported in two places costs one listener, and a mounted
 * tree that unmounts leaves none behind.
 *
 * On the server, and in a browser with no `matchMedia`, it reports
 * {@link MediaQueryOptions.fallback} — `false` unless you say otherwise. It
 * reports that through hydration too, so the pass matches the markup the
 * server produced, and switches to the real answer immediately after.
 */
export function mediaQuery(query: string, options: MediaQueryOptions = {}): Readable<boolean> {
	return new MediaQuery(query, options.fallback ?? false);
}
