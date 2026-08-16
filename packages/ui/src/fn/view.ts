/**
 * The core contracts of the lazy, function-based model.
 *
 * A `View` is anything that can mount into a parent (optionally before an
 * anchor node) and unmount again. A `Child` is either a `View` or a thunk
 * returning one — thunks are invoked at mount time, so subtrees passed as
 * functions are not constructed until (unless) they are actually shown.
 */

import { isReadable, subscribeTracked, type Readable } from "../signal";
import type { Unsubscribe } from "../types";
import { runInScope } from "./scope";

export interface View {
	mount(parent: HTMLElement, before?: Node | null): void;
	unmount(): void;
}

export type Child = View | (() => View);

/** Invoke a thunk child; pass an already-constructed view through. */
export function realize(child: Child): View {
	return typeof child === "function" ? child() : child;
}

/**
 * The one shape every reactive prop accepts: a plain value, a Readable, or an
 * auto-tracked getter. This replaces the three-overload
 * `value | Readable | [signals, getter]` pattern — and because it is a single
 * value rather than an overload set, wrapper components can forward props
 * without re-implementing anything (PAPERCUTS.md #11).
 */
export type PropInput<V> = V | Readable<V> | (() => V);

/**
 * Apply a `PropInput`: statics apply once, Readables and getters subscribe.
 * Exported so userland components get the same binding power as built-ins.
 */
export function watchProp<V>(input: PropInput<V>, apply: (value: V) => void): Unsubscribe {
	if (typeof input === "function") {
		return subscribeTracked(input as () => V, apply);
	}
	if (isReadable<V>(input)) {
		return subscribeTracked(() => input.get(), apply);
	}
	apply(input);
	return () => {};
}

/** A realized-and-mounted set of children plus the disposer for their scope. */
export type ActiveRegion = {
	views: View[];
	dispose: () => void;
};

/**
 * Realize `children` inside a fresh scope and mount them before `before`.
 * Dynamic regions (If branches, ForEach rows, Key subtrees) go through this,
 * so each activation constructs fresh state and each deactivation disposes it.
 */
export function mountRegion(
	children: readonly Child[],
	parent: HTMLElement,
	before: Node | null,
): ActiveRegion {
	const [views, dispose] = runInScope(() => children.map(realize));
	for (const view of views) {
		view.mount(parent, before);
	}
	return { views, dispose };
}

export function unmountRegion(region: ActiveRegion): void {
	for (const view of region.views) {
		view.unmount();
	}
	region.dispose();
}
