import { dom } from "../../dom";
import equal from "fast-deep-equal";
import { isReadable, subscribe, type Getter, type Readable } from "../../signal";
import { asParent, guarded, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { syncDomOrder } from "../../utils";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

const remainingBrand = Symbol("switch.remaining");

type SwitchCase = {
	value: unknown;
	children: Child[];
};

export type SwitchHelper<T, Remaining extends T = T> = Mountable & {
	readonly [remainingBrand]: Remaining;
	Case<V extends Remaining>(value: V, ...children: Child[]): SwitchHelper<T, Exclude<Remaining, V>>;
	Default(...children: Child[]): SwitchHelper<T, Remaining>;
	Exhaustive: [Remaining] extends [never] ? () => SwitchHelper<T, never> : never;
};

/**
 * Mounts the first `Case` whose value deep-equals the subject, falling back
 * to `Default` children. Conditions live in `If`/`ElseIf`; `Switch` matches
 * values.
 *
 * Children close over reactive values themselves. `Switch` only chooses which
 * branch to mount.
 *
 * ```ts
 * Switch(status)
 * 	.Case("todo", Icon("circle"))
 * 	.Case("done", Icon("check"))
 * 	.Default(Icon("question"));
 * ```
 */
export function Switch<T>(signal: Readable<T>): SwitchHelper<T>;
export function Switch<T, Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<T, Signals>,
): SwitchHelper<T>;
export function Switch<T>(
	signalOrSignals: Readable<T> | readonly Readable<unknown>[],
	getter?: Getter<T, readonly Readable<unknown>[]>,
): SwitchHelper<T> {
	const signals: readonly Readable<unknown>[] = isReadable(signalOrSignals)
		? [signalOrSignals]
		: signalOrSignals;
	const getSubject: (...values: unknown[]) => T = isReadable(signalOrSignals)
		? (value) => value as T
		: (getter as (...values: unknown[]) => T);

	const cases: SwitchCase[] = [];
	let defaultChildren: Child[] = [];

	const helper = Object.assign(
		(): IMountable => {
			let parent: HTMLElement | null = null;
			let unsubscribe: Unsubscribe | null = null;
			let showing: number | "default" | null = null;
			let mounted: IMountable[] = [];
			const endMarker = dom.createComment("");

			const childrenFor = (target: number | "default"): Child[] =>
				target === "default" ? defaultChildren : cases[target]!.children;

			const clear = () => {
				for (const child of mounted) child.unmount();
				mounted = [];
			};

			let node: IMountable;

			const show = (target: number | "default") => {
				if (showing === target) return;
				clear();
				showing = target;
				if (!parent) return;

				asParent(node, () => {
					for (const child of reconcileChildren({}, ...childrenFor(target))) {
						const instance = child();
						mounted.push(instance);
						mountChild(instance, parent!);
					}
				});
				syncDomOrder(
					parent,
					mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
					endMarker,
				);
			};

			const reconcile = (...values: unknown[]) => {
				const subject = getSubject(...values);
				let target: number | "default" = "default";
				for (let i = 0; i < cases.length; i++) {
					if (equal(subject, cases[i]!.value)) {
						target = i;
						break;
					}
				}
				show(target);
			};

			node = {
				mount(p: HTMLElement) {
					unsubscribe?.();
					clear();
					showing = null;
					parent = p;
					dom.attach(parent, endMarker);
					unsubscribe = subscribe(signals, (...values: unknown[]) =>
						guarded(node, () => reconcile(...values)),
					);
				},
				unmount() {
					unsubscribe?.();
					unsubscribe = null;
					clear();
					showing = null;
					endMarker.remove();
					parent = null;
				},
				getFirstDomNode() {
					for (const child of mounted) {
						const first = child.getFirstDomNode();
						if (first) return first;
					}
					return endMarker.isConnected ? endMarker : null;
				},
			};
			return node;
		},
		{
			[remainingBrand]: undefined as unknown as T,
			Case<V extends T>(value: V, ...children: Child[]): SwitchHelper<T, Exclude<T, V>> {
				cases.push({ value, children });
				return helper as SwitchHelper<T, Exclude<T, V>>;
			},
			Default(...children: Child[]) {
				defaultChildren = children;
				return helper;
			},
			Exhaustive() {
				return helper as SwitchHelper<T, never>;
			},
		},
	);

	return helper as SwitchHelper<T>;
}
