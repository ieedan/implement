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

type IfCondition = boolean | Readable<unknown> | readonly Readable<any>[];

type IfBranch = {
	signals: readonly Readable<any>[];
	getCondition: IfConditionGetter;
	children: Mountable[];
};

function toBranch(condition: IfCondition, getter?: IfConditionGetter): IfBranch {
	if (typeof condition === "boolean") {
		return { signals: [], getCondition: () => condition, children: [] };
	}

	if (!Array.isArray(condition)) {
		return {
			signals: [condition as Readable<unknown>],
			getCondition: (value: unknown) => Boolean(value),
			children: [],
		};
	}

	return { signals: condition, getCondition: getter as IfConditionGetter, children: [] };
}

class _if extends MountNode {
	private branches: IfBranch[];
	private elseChildren: Mountable[] = [];
	private unsubscribe: Unsubscribe | null = null;
	private showing: number | "else" | null = null;

	constructor(condition: IfCondition, getter?: IfConditionGetter) {
		super();
		this.branches = [toBranch(condition, getter)];
	}

	/** Children mounted while the preceding `If`/`ElseIf` condition is true. */
	Then(...children: Mountable[]): this {
		this.branches[this.branches.length - 1]!.children = children;
		this.syncChildren();
		return this;
	}

	/**
	 * Adds a branch checked when every preceding condition is false. Accepts
	 * the same forms as `If`; chain `.Then(...)` to give it children.
	 */
	ElseIf(condition: boolean | Readable<unknown>): this;
	ElseIf<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<boolean, Signals>,
	): this;
	ElseIf(condition: IfCondition, getter?: IfConditionGetter): this {
		this.branches.push(toBranch(condition, getter));
		return this;
	}

	/** Children mounted while every condition is false. */
	Else(...children: Mountable[]): this {
		this.elseChildren = children;
		this.syncChildren();
		return this;
	}

	private syncChildren() {
		this.children = [...this.branches.flatMap((branch) => branch.children), ...this.elseChildren];
		for (const child of this.children) {
			this.adopt(child);
		}
	}

	private childrenFor(target: number | "else"): Mountable[] {
		return target === "else" ? this.elseChildren : this.branches[target]!.children;
	}

	mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.children.forEach((child) => child.unmount());
		this.showing = null;
		this.parent = parent;

		const signals = this.branches.flatMap((branch) => branch.signals);
		this.unsubscribe = subscribe(signals, () => {
			let target: number | "else" = "else";
			for (let i = 0; i < this.branches.length; i++) {
				const branch = this.branches[i]!;
				if (branch.getCondition(...branch.signals.map((signal) => signal.get()))) {
					target = i;
					break;
				}
			}
			if (this.showing === target) return;

			if (this.showing !== null) {
				this.childrenFor(this.showing).forEach((child) => child.unmount());
			}

			this.showing = target;
			this.childrenFor(target).forEach((child) => child.mount(parent));
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.showing = null;
		super.unmount();
	}
}

/**
 * A signal passed on its own is checked for truthiness, so
 * `If(user)` is enough when the intent is `user !== null`.
 *
 * Branches chain: `If(a).Then(...).ElseIf(b).Then(...).Else(...)` mounts the
 * first branch whose condition holds.
 */
export function If(condition: boolean | Readable<unknown>): _if;
export function If<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<boolean, Signals>,
): _if;
export function If(condition: IfCondition, getter?: IfConditionGetter) {
	return new (_if as new (condition: IfCondition, getter?: IfConditionGetter) => _if)(
		condition,
		getter,
	);
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

class _portal extends MountNode {
	private target: HTMLElement | null = null;

	/** Sets the element the children mount into. Without it, `document.body`. */
	To(target: HTMLElement): this {
		this.target = target;
		return this;
	}

	override getFirstDomNode(): Node | null {
		// the portal's DOM lives in the target, so logical siblings must never
		// use it as an insertion anchor
		return null;
	}

	protected override getInsertBeforeNode(): Node | null {
		// children append to the target; never anchor against the logical tree
		return null;
	}

	mount(_parent: HTMLElement) {
		const target = this.target ?? document.body;
		this.parent = target;
		for (const child of this.children) {
			child.mount(target);
		}
	}
}

/**
 * Mounts its children into another element — `Portal(...children).To(target)`,
 * or `document.body` when no `.To()` is given — escaping ancestor
 * stacking/overflow contexts. The children stay part of the logical tree, so
 * context lookup and unmounting (e.g. from a wrapping `If`) behave as if they
 * were rendered in place.
 */
export function Portal(...children: Mountable[]): _portal {
	return new _portal(...children);
}

type KeyRender = (...values: any[]) => Mountable | null;

class _key extends MountNode {
	private signals: readonly Readable<any>[];
	private render: KeyRender;
	private unsubscribe: Unsubscribe | null = null;
	private current: Mountable | null = null;

	constructor(signalOrSignals: Readable<any> | readonly Readable<any>[], render: KeyRender) {
		super();
		this.signals = Array.isArray(signalOrSignals)
			? signalOrSignals
			: [signalOrSignals as Readable<any>];
		this.render = render;
	}

	mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.current?.unmount();
		this.current = null;
		this.parent = parent;

		this.unsubscribe = subscribe(this.signals, (...values) => {
			this.current?.unmount();
			const child = this.render(...values);
			this.current = child;
			this.children = child ? [child] : [];
			if (child) {
				this.adopt(child);
				child.mount(parent);
			}
		});
	}

	override unmount() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		super.unmount();
		this.current = null;
		this.children = [];
	}
}

/**
 * Rebuilds its child from scratch whenever the watched signal(s) change —
 * the render callback receives the current value(s) and returns the new
 * subtree (or `null` to render nothing).
 *
 * ```ts
 * Key(route, (route) => PageFor(route));
 * Key([route, issues], (route, issues) => ...);
 * ```
 */
export function Key<T>(signal: Readable<T>, render: (value: T) => Mountable | null): _key;
export function Key<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	render: Getter<Mountable | null, Signals>,
): _key;
export function Key(
	signalOrSignals: Readable<any> | readonly Readable<any>[],
	render: KeyRender,
): _key {
	return new (_key as new (
		signalOrSignals: Readable<any> | readonly Readable<any>[],
		render: KeyRender,
	) => _key)(signalOrSignals, render);
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
