import equal from "fast-deep-equal";
import { Component } from "./component";
import { subscribe, type Getter, type Readable, type Signal } from "./signal";
import type { Unsubscribe } from "./types";

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

	// we override mount so that we don't render anything. This is essentially a fragment
	override mount(parent: HTMLElement) {
		this.unsubscribe?.();
		this.unsubscribe = subscribe([this.signal], (value) => {
			let mountedKeys = new Set<string>();
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
					// if the position and data has not changed then we know the component doesn't need to re-render
					if (existing.index === i && equal(existing.value, currentVal)) {
						continue;
					}

					// otherwise we are going to replace the old
					existing.component.create().replaceWith(child.create());
					updateRendered();
					continue;
				}

				// mount brand new it doesn't exist yet
				// however we do need to maintain order so this is will interesting

				child.mount(parent);
				updateRendered();
			}

			for (const [key, { component }] of this.rendered.entries()) {
				if (!mountedKeys.has(key)) {
					component.unmount();
					this.rendered.delete(key);
				}
			}
		});
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
		this.unsubscribe = subscribe(this.signals, (...values) => {
			const value = this.getCondition(...values);

			if (value) {
				this.children.forEach((child) => child.mount(parent));
			} else {
				this.children.forEach((child) => child.unmount());
			}
		});
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
		for (const child of this.children) {
			child.mount(parent);
		}
	}
}

export function Fragment(...children: Component<any>[]) {
	return new _fragment(...children);
}
