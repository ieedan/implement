import { reconcileChildren } from "./components";
import type { Child, IMountable, Mountable } from "./components/types";
import { mountChild, parentOf } from "./tree";

class ContextProvideBuilder<T> {
	constructor(
		private readonly context: context<T>,
		private readonly value: T,
	) { }

	To(...children: Child[]): Mountable {
		const context = this.context;
		const value = this.value;
		return () => {
			const childrenArray = reconcileChildren({}, ...children);
			const mountedChildren: IMountable[] = [];
			const node: IMountable = {
				mount(parent: HTMLElement) {
					mountedChildren.length = 0;
					context.provide(node, value);
					for (const child of childrenArray) {
						const instance = child();
						mountedChildren.push(instance);
						mountChild(instance, parent);
					}
				},
				unmount() {
					for (const child of mountedChildren) child.unmount();
					mountedChildren.length = 0;
				},
				getFirstDomNode() {
					for (const child of mountedChildren) {
						const first = child.getFirstDomNode();
						if (first) return first;
					}
					return null;
				},
			};
			return node;
		};
	}
}

function contextUse<T>(
	context: context<T>,
	render: (value: T) => Child,
	fallback?: { value: T },
): Mountable {
	return () => {
		let mounted: IMountable[] = [];
		const node: IMountable = {
			mount(parent: HTMLElement) {
				for (const child of mounted) child.unmount();
				mounted = [];

				const result = context.lookup(node);
				let value: T;
				if (result.found) {
					value = result.value;
				} else if (fallback) {
					value = fallback.value;
				} else {
					throw new Error("context.Use() was called without a matching context.Provide()");
				}

				for (const child of reconcileChildren({}, render(value))) {
					const instance = child();
					mounted.push(instance);
					mountChild(instance, parent);
				}
			},
			unmount() {
				for (const child of mounted) child.unmount();
				mounted = [];
			},
			getFirstDomNode() {
				for (const child of mounted) {
					const first = child.getFirstDomNode();
					if (first) return first;
				}
				return null;
			},
		};
		return node;
	};
}

class ContextStore<T> {
	readonly #values = new WeakMap<IMountable, T>();

	provide(node: IMountable, value: T): void {
		this.#values.set(node, value);
	}

	lookup(from: IMountable): { found: true; value: T } | { found: false } {
		let node = parentOf(from);
		while (node) {
			if (this.#values.has(node)) return { found: true, value: this.#values.get(node)! };
			node = parentOf(node);
		}
		return { found: false };
	}

	Provide(value: T): ContextProvideBuilder<T> {
		return new ContextProvideBuilder(this, value);
	}

	Use(render: (value: T) => Child): Mountable {
		return contextUse(this, render);
	}

	UseOr(render: (value: T) => Child, fallback: T): Mountable {
		return contextUse(this, render, { value: fallback });
	}
}

export type context<T> = ContextStore<T>;

/**
 * Create a context for passing a value down the tree without props.
 *
 * `Provide(value).To(...children)` wraps a subtree. `Use(render)` reads the
 * nearest provided value and throws if missing. `UseOr(render, fallback)`
 * supplies a default.
 */
export function context<T>(): context<T> {
	return new ContextStore();
}
