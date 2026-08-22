import type { IMountable } from "./components/types";
import { isHydrating, withMountParent } from "./hydration";
import { toError } from "./utils";

let current: IMountable | null = null;

/**
 * Where a node's tree parent is kept. A property rather than a `WeakMap`
 * because this is written once per node — a hundred thousand times to build ten
 * thousand rows — and a weak-map write measures around forty times the cost of
 * a symbol assignment. The symbol keeps it off every ordinary view of the
 * object, and nothing outlives the node it is written on.
 */
const PARENT = Symbol("implementjs.treeParent");

type Linked = IMountable & { [PARENT]?: IMountable | null };

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

/**
 * Mount `instance` as a child of the current tree node. Written out rather than
 * composed from `asParent` and `withMountParent` because it runs once per node
 * in the tree — a hundred thousand times to build ten thousand rows — and the
 * two callbacks that composition needs are two allocations each time.
 */
export function mountChild(instance: IMountable, htmlParent: HTMLElement): void {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The parent link is a symbol-keyed field core owns on the nodes it mounts.
	(instance as Linked)[PARENT] = current;
	const previous = current;
	current = instance;
	try {
		if (isHydrating()) withMountParent(htmlParent, () => instance.mount(htmlParent));
		else instance.mount(htmlParent);
	} finally {
		current = previous;
	}
}

/**
 * Depth of the subtree currently being taken out of the document. An element
 * that removes itself takes every descendant with it, so anything unmounting
 * below one does not need its own removal — it only needs to release its
 * subscriptions.
 */
let detaching = 0;

/** True while an ancestor is removing the node this tree hangs from. */
export function isDetaching(): boolean {
	return detaching > 0;
}

/**
 * Bracket the unmount of children the caller is about to remove wholesale.
 * A pair of counter calls rather than a callback, because this runs once per
 * element in a discarded subtree and a closure per element is exactly the
 * allocation this optimization exists to avoid.
 */
export function beginDetach(): void {
	detaching++;
}

export function endDetach(): void {
	detaching--;
}

/**
 * Depth of the unmount currently discarding the nodes it visits. Core never
 * re-mounts an element it has unmounted, so a listener on one of them dies with
 * the node and does not need removing first.
 */
let discarding = 0;

export function isDiscarding(): boolean {
	return discarding > 0;
}

export function beginDiscard(): void {
	discarding++;
}

export function endDiscard(): void {
	discarding--;
}

/**
 * Run `fn` outside any ancestor's detach. For a subtree mounted into a parent
 * of its own (`Portal`), the ancestor's removal takes nothing of it away.
 */
export function reattached(fn: () => void): void {
	const previous = detaching;
	detaching = 0;
	try {
		fn();
	} finally {
		detaching = previous;
	}
}

export function parentOf(node: IMountable): IMountable | null {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reads back the link written by `mountChild`.
	return (node as Linked)[PARENT] ?? null;
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
