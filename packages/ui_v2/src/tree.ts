import type { IMountable } from "./components/types";

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
		instance.mount(htmlParent);
	});
}

export function parentOf(node: IMountable): IMountable | null {
	return parents.get(node) ?? null;
}
