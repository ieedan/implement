import equal from "fast-deep-equal";
import { Component } from "./component";
import { MountNode, type Mountable } from "./mountable";
import { isReadable, Signal, subscribe, type Getter, type Readable } from "./signal";
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

/** Receives a live `[item, index]` entry that ForEach patches in place on later updates. */
type ForEachRender<T> = (entry: Readable<[T, number]>) => Mountable;

type RenderedEntry<T> = {
	child: Mountable;
	entry: Signal<[T, number]>;
	value: T;
	index: number;
};

class _forEach<T> extends MountNode {
	private signals: readonly Readable<any>[];
	private getItems: (...values: any[]) => readonly T[];
	private render: ForEachRender<T>;
	private unsubscribe: Unsubscribe | null = null;
	private rendered: Map<string, RenderedEntry<T>> = new Map();

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
				// render with a fresh entry signal to learn the child's key; if the
				// key is already mounted the fresh child is discarded and the
				// existing child's entry signal is patched instead
				const entry = new Signal<[T, number]>([currentVal, i]);
				const child = this.render(entry);

				const key = getKey(child, i);
				if (mountedKeys.has(key)) {
					throw new Error(`Duplicate key found in ForEach component: ${key}`);
				}
				mountedKeys.add(key);
				const existing = this.rendered.get(key);
				if (existing) {
					if (!equal(existing.value, currentVal) || existing.index !== i) {
						existing.value = currentVal;
						existing.index = i;
						existing.entry.set([currentVal, i]);
					}
					ordered.push(existing.child);
					continue;
				}

				this.adopt(child);
				child.mount(parent);
				this.rendered.set(key, { child, entry, index: i, value: currentVal });
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
	private thenChildren: Mountable[] = [];
	private elseChildren: Mountable[] = [];
	private showing: "then" | "else" | null = null;

	constructor(
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getter?: IfConditionGetter,
	) {
		super();

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
		this.getCondition = getter as IfConditionGetter;
	}

	/** Children mounted while the condition is true. */
	Then(...children: Mountable[]): this {
		this.thenChildren = children;
		this.syncChildren();
		return this;
	}

	/** Children mounted while the condition is false. */
	Else(...children: Mountable[]): this {
		this.elseChildren = children;
		this.syncChildren();
		return this;
	}

	private syncChildren() {
		this.children = [...this.thenChildren, ...this.elseChildren];
		for (const child of this.children) {
			this.adopt(child);
		}
	}

	mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.children.forEach((child) => child.unmount());
		this.showing = null;
		this.parent = parent;

		this.unsubscribe = subscribe(this.signals, (...values) => {
			const target = this.getCondition(...values) ? "then" : "else";
			if (this.showing === target) return;

			if (this.showing === "then") this.thenChildren.forEach((child) => child.unmount());
			if (this.showing === "else") this.elseChildren.forEach((child) => child.unmount());

			this.showing = target;
			const branch = target === "then" ? this.thenChildren : this.elseChildren;
			branch.forEach((child) => child.mount(parent));
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.showing = null;
		super.unmount();
	}
}

export function If(condition: boolean | Readable<boolean>): _if;
export function If<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<boolean, Signals>,
): _if;
export function If(
	conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
	getter?: IfConditionGetter,
) {
	return new (_if as new (
		conditionOrSignalOrSignals: boolean | Readable<boolean> | readonly Readable<any>[],
		getter?: IfConditionGetter,
	) => _if)(conditionOrSignalOrSignals, getter);
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

function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return new Error(error.message);
	}
	return new Error(String(error));
}

type AwaitState<T> =
	| { status: "pending" }
	| { status: "resolved"; value: Signal<T> }
	| { status: "rejected"; error: Error };

class _await<T> extends MountNode {
	private state: AwaitState<T> = { status: "pending" };
	private loadingChild: Mountable | null = null;
	private thenRender: ((value: Signal<T>) => Mountable) | null = null;
	private catchRender: ((error: Error) => Mountable) | null = null;
	private thenChild: Mountable | null = null;
	private catchChild: Mountable | null = null;
	private current: Mountable | null = null;
	private mounted = false;

	constructor(promise: PromiseLike<T>) {
		super();
		void promise.then(
			(value) => {
				this.state = { status: "resolved", value: new Signal(value) };
				this.thenChild = null;
				this.sync();
			},
			(error) => {
				this.state = { status: "rejected", error: toError(error) };
				this.catchChild = null;
				this.sync();
			},
		);
	}

	WhileLoading(child: Mountable): this {
		this.loadingChild = child;
		this.sync();
		return this;
	}

	Then(render: (value: Signal<T>) => Mountable): this {
		this.thenRender = render;
		this.thenChild = null;
		this.sync();
		return this;
	}

	Catch(render: (error: Error) => Mountable): this {
		this.catchRender = render;
		this.catchChild = null;
		this.sync();
		return this;
	}

	mount(parent: HTMLElement) {
		this.parent = parent;
		this.mounted = true;
		this.current = null;
		this.sync();
	}

	override unmount() {
		this.mounted = false;
		this.current = null;
		super.unmount();
	}

	private childForState(): Mountable | null {
		if (this.state.status === "pending") {
			return this.loadingChild;
		}

		if (this.state.status === "resolved") {
			if (!this.thenChild && this.thenRender) {
				try {
					this.thenChild = this.thenRender(this.state.value);
				} catch (error) {
					this.state = { status: "rejected", error: toError(error) };
					return this.childForState();
				}
			}
			return this.thenChild;
		}

		if (!this.catchChild && this.catchRender) {
			this.catchChild = this.catchRender(this.state.error);
		}
		return this.catchChild;
	}

	private sync() {
		if (!this.mounted || !this.parent) return;

		const next = this.childForState();
		if (this.current === next) return;

		this.current?.unmount();
		this.current = next;
		this.children = next ? [next] : [];
		if (next) {
			this.adopt(next);
			next.mount(this.parent);
		}
	}
}

export function Await<T>(promise: PromiseLike<T>): _await<T> {
	return new _await(promise);
}
