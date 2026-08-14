import equal from "fast-deep-equal";
import { Component } from "./component";
import { MountNode, type Mountable } from "./mountable";
import { isReadable, subscribe, type Getter, type Readable, type Signal } from "./signal";
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

function getKey(child: Mountable, index: number): string {
	if (child instanceof Component) {
		return (child.props.key ?? index).toString();
	}
	return index.toString();
}

type ForEachRender<T> = Getter<Mountable, [Signal<[T, number]>]>;

class _forEach<T> extends MountNode {
	private signals: readonly Readable<any>[];
	private getItems: (...values: any[]) => readonly T[];
	private render: ForEachRender<T>;
	private unsubscribe: Unsubscribe | null = null;
	private rendered: Map<string, { child: Mountable; value: T; index: number }> = new Map();

	constructor(items: readonly T[], render: ForEachRender<T>);
	constructor(signal: Readable<T[]>, render: ForEachRender<T>);
	constructor(itemsOrSignal: readonly T[] | Readable<T[]>, render: ForEachRender<T>) {
		super();
		this.render = render;

		if (isReadable<T[]>(itemsOrSignal)) {
			this.signals = [itemsOrSignal];
			this.getItems = (value: T[]) => value;
			return;
		}

		this.signals = [];
		this.getItems = () => itemsOrSignal;
	}

	override getFirstDomNode(): Node | null {
		let first: { child: Mountable; index: number } | null = null;
		for (const entry of this.rendered.values()) {
			if (!first || entry.index < first.index) first = entry;
		}
		return first?.child.getFirstDomNode() ?? null;
	}

	mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.parent = parent;

		this.unsubscribe = subscribe(this.signals, (...values) => {
			const value = this.getItems(...values);
			const mountedKeys = new Set<string>();
			const ordered: Mountable[] = [];

			for (let i = 0; i < value.length; i++) {
				const currentVal = value[i]!;
				const child = this.render([currentVal, i]);

				const updateRendered = () => this.rendered.set(key, { child, index: i, value: currentVal });

				const key = getKey(child, i);
				if (mountedKeys.has(key)) {
					throw new Error(`Duplicate key found in ForEach component: ${key}`);
				}
				mountedKeys.add(key);
				const existing = this.rendered.get(key);
				if (existing) {
					if (equal(existing.value, currentVal)) {
						if (existing.index !== i) {
							this.rendered.set(key, {
								child: existing.child,
								index: i,
								value: currentVal,
							});
						}
						ordered.push(existing.child);
						continue;
					}

					existing.child.unmount();
				}

				this.adopt(child);
				child.mount(parent);
				updateRendered();
				ordered.push(child);
			}

			for (const [key, { child }] of this.rendered.entries()) {
				if (!mountedKeys.has(key)) {
					child.unmount();
					this.rendered.delete(key);
				}
			}

			syncDomOrder(
				parent,
				ordered
					.map((child) => child.getFirstDomNode())
					.filter((node): node is Node => node !== null),
				this.getInsertBeforeNode(),
			);
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		for (const { child } of this.rendered.values()) {
			child.unmount();
		}
		this.rendered.clear();
		super.unmount();
	}
}

export function ForEach<T>(items: readonly T[], render: ForEachRender<T>): _forEach<T>;
export function ForEach<T>(signal: Readable<T[]>, render: ForEachRender<T>): _forEach<T>;
export function ForEach<T>(itemsOrSignal: readonly T[] | Readable<T[]>, render: ForEachRender<T>) {
	return new (_forEach as new (
		itemsOrSignal: readonly T[] | Readable<T[]>,
		render: ForEachRender<T>,
	) => _forEach<T>)(itemsOrSignal, render);
}

type IfConditionGetter = (...values: any[]) => boolean;

class _if extends MountNode {
	private signals: readonly Readable<any>[];
	private getCondition: IfConditionGetter;
	private unsubscribe: Unsubscribe | null = null;
	private showing = false;

	constructor(condition: boolean, ...children: Mountable[]);
	constructor(signal: Readable<boolean>, ...children: Mountable[]);
	constructor(
		signals: readonly Readable<any>[],
		getter: IfConditionGetter,
		...children: Mountable[]
	);
	constructor(
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getterOrFirstChild?: IfConditionGetter | Mountable,
		...restChildren: Mountable[]
	) {
		const children = Array.isArray(conditionOrSignalOrSignals)
			? restChildren
			: getterOrFirstChild != null
				? [getterOrFirstChild as Mountable, ...restChildren]
				: restChildren;

		super(...children);

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

	mount(parent: HTMLElement) {
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

export function If(condition: boolean, ...children: Mountable[]): _if;
export function If(signal: Readable<boolean>, ...children: Mountable[]): _if;
export function If<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<boolean, Signals>,
	...children: Mountable[]
): _if;
export function If(
	conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
	getterOrFirstChild?: IfConditionGetter | Mountable,
	...restChildren: Mountable[]
) {
	return new (_if as new (
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getterOrFirstChild?: IfConditionGetter | Mountable,
		...restChildren: Mountable[]
	) => _if)(conditionOrSignalOrSignals, getterOrFirstChild, ...restChildren);
}

class _fragment extends MountNode {
	mount(parent: HTMLElement) {
		this.parent = parent;
		for (const child of this.children) {
			child.mount(parent);
		}
	}
}

export function Fragment(...children: Mountable[]) {
	return new _fragment(...children);
}
