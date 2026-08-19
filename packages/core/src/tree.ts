import type { IMountable } from "./components/types";
import { withMountParent } from "./hydrate";
import { toError } from "./utils";

let current: IMountable | null = null;

const parents = new WeakMap<IMountable, IMountable | null>();

/** Run `fn` with `node` as the current tree parent. Needed when creating children after `mount` returns (If, ForEach). */
export function asParent<T>(node: IMountable, fn: () => T): T {
	const prev = current;
	current = node;
	try {
		return fn();
	} finally {
		current = prev;
	}
}

/** Mount `instance` as a child of the current tree node. */
export function mountChild(instance: IMountable, htmlParent: HTMLElement): void {
	parents.set(instance, current);
	asParent(instance, () => {
		withMountParent(htmlParent, () => {
			instance.mount(htmlParent);
		});
	});
}

export function parentOf(node: IMountable): IMountable | null {
	return parents.get(node) ?? null;
}

const boundaries = new WeakMap<IMountable, (error: Error) => void>();

/** Mark `node` as an error boundary. Errors raised at or below it route to `handler`. */
export function registerBoundary(node: IMountable, handler: (error: Error) => void): void {
	boundaries.set(node, handler);
}

/**
 * Route `error` to the nearest boundary at or above `from`. Returns false when
 * no boundary claims it, leaving the caller to rethrow.
 */
export function raiseError(from: IMountable | null | undefined, error: unknown): boolean {
	let node = from ?? null;
	while (node) {
		const handler = boundaries.get(node);
		if (handler) {
			handler(toError(error));
			return true;
		}
		node = parentOf(node);
	}
	return false;
}

/**
 * Run `fn`, routing anything it throws to the nearest boundary at or above
 * `node`. Reactive helpers wrap their sync passes in this so an error thrown
 * during a signal-driven update — off any boundary's own mount stack — still
 * reaches the boundary. Without a boundary above, the error rethrows.
 */
export function guarded(node: IMountable | null | undefined, fn: () => void): void {
	try {
		fn();
	} catch (error) {
		if (!raiseError(node, error)) throw error;
	}
}
