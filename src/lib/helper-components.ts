import equal from "fast-deep-equal";
import { Component } from "./component";
import { subscribe, type Getter, type Readable, type Signal } from "./signal";
import type { Unsubscribe } from "./types";

function syncDomOrder(parent: HTMLElement, nodes: Node[], before: Node | null) {
	let cursor: Node | null = before;
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i]!;
		if (node.nextSibling !== cursor) {
			parent.insertBefore(node, cursor);
		}
		cursor = node;
	}
}

class _forEach<T> extends Component<"div"> {
	private signal: Signal<T[]>;
	private render: Getter<Component<any>, [Signal<[T, number]>]>;
	private unsubscribe: Unsubscribe | null = null;
	private rendered: Map<string, { component: Component<any>; value: T; index: number }> = new Map();
	constructor(signal: Signal<T[]>, render: Getter<Component<any>, [Signal<[T, number]>]>) {
		super("div");
		this.signal = signal;
		this.render = render;
	}

	override getFirstDomNode(): Node | null {
		let first: { component: Component<any>; index: number } | null = null;
		for (const entry of this.rendered.values()) {
			if (!first || entry.index < first.index) first = entry;
		}
		return first?.component.getFirstDomNode() ?? null;
	}

	// we override mount so that we don't render anything. This is essentially a fragment
	override mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.parent = parent;

		this.unsubscribe = subscribe([this.signal], (value) => {
			const mountedKeys = new Set<string>();
			const ordered: Component<any>[] = [];

			for (let i = 0; i < value.length; i++) {
				const currentVal = value[i]!;
				const child = this.render([currentVal, i]);

				const updateRendered = () =>
					this.rendered.set(key, { component: child, index: i, value: currentVal });

				const key = (child.props.key ?? i).toString();
				if (mountedKeys.has(key)) {
					throw new Error(`Duplicate key found in ForEach component: ${key}`);
				}
				mountedKeys.add(key);
				const existing = this.rendered.get(key);
				if (existing) {
					if (equal(existing.value, currentVal)) {
						if (existing.index !== i) {
							this.rendered.set(key, {
								component: existing.component,
								index: i,
								value: currentVal,
							});
						}
						ordered.push(existing.component);
						continue;
					}

					existing.component.unmount();
				}

				this.adopt(child);
				child.mount(parent);
				updateRendered();
				ordered.push(child);
			}

			for (const [key, { component }] of this.rendered.entries()) {
				if (!mountedKeys.has(key)) {
					component.unmount();
					this.rendered.delete(key);
				}
			}

			syncDomOrder(
				parent,
				ordered.map((component) => component.create()),
				this.getInsertBeforeNode(),
			);
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		for (const { component } of this.rendered.values()) {
			component.unmount();
		}
		this.rendered.clear();
		super.unmount();
	}
}

export function ForEach<T>(
	signal: Signal<T[]>,
	render: Getter<Component<any>, [Signal<[T, number]>]>,
) {
	return new _forEach(signal, render);
}

type IfConditionGetter = (...values: any[]) => boolean;

class _if extends Component<"div"> {
	private signals: readonly Readable<any>[];
	private getCondition: IfConditionGetter;
	private unsubscribe: Unsubscribe | null = null;
	private showing = false;

	constructor(condition: boolean, ...children: Component<any>[]);
	constructor(signal: Readable<boolean>, ...children: Component<any>[]);
	constructor(
		signals: readonly Readable<any>[],
		getter: IfConditionGetter,
		...children: Component<any>[]
	);
	constructor(
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getterOrFirstChild?: IfConditionGetter | Component<any>,
		...restChildren: Component<any>[]
	) {
		const children = Array.isArray(conditionOrSignalOrSignals)
			? restChildren
			: getterOrFirstChild != null
				? [getterOrFirstChild as Component<any>, ...restChildren]
				: restChildren;

		super("div", ...children);

		if (typeof conditionOrSignalOrSignals === "boolean") {
			this.signals = [];
			this.getCondition = () => conditionOrSignalOrSignals;
			return;
		}

		if (!Array.isArray(conditionOrSignalOrSignals)) {
			this.signals = [conditionOrSignalOrSignals as Readable<boolean>];
			this.getCondition = (value: boolean) => value;
			return;
		}

		this.signals = conditionOrSignalOrSignals;
		this.getCondition = getterOrFirstChild as IfConditionGetter;
	}

	// we override mount so that we don't render anything. This is essentially a fragment
	override mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.children.forEach((child) => child.unmount());
		this.showing = false;
		this.parent = parent;

		this.unsubscribe = subscribe(this.signals, (...values) => {
			const value = this.getCondition(...values);

			if (value) {
				if (this.showing) return;
				this.showing = true;
				this.children.forEach((child) => child.mount(parent));
			} else {
				if (!this.showing) return;
				this.showing = false;
				this.children.forEach((child) => child.unmount());
			}
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.showing = false;
		super.unmount();
	}
}

export function If(condition: boolean, ...children: Component<any>[]): _if;
export function If(signal: Readable<boolean>, ...children: Component<any>[]): _if;
export function If<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<boolean, Signals>,
	...children: Component<any>[]
): _if;
export function If(
	conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
	getterOrFirstChild?: IfConditionGetter | Component<any>,
	...restChildren: Component<any>[]
) {
	return new (_if as new (
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getterOrFirstChild?: IfConditionGetter | Component<any>,
		...restChildren: Component<any>[]
	) => _if)(conditionOrSignalOrSignals, getterOrFirstChild, ...restChildren);
}

class _fragment extends Component<"div"> {
	constructor(...children: Component<any>[]) {
		super("div", ...children);
	}

	// we override mount here so that we don't actually create a component and we don't do any binding
	override mount(parent: HTMLElement) {
		this.parent = parent;
		for (const child of this.children) {
			child.mount(parent);
		}
	}
}

export function Fragment(...children: Component<any>[]) {
	return new _fragment(...children);
}
