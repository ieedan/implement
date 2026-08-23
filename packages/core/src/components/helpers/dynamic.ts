import { dom } from "../../dom";
import {
	isReadable,
	subscribe,
	type Getter,
	type Readable,
	type ReadableSource,
} from "../../signal";
import { asParent, guarded, isDetaching, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { syncDomOrder } from "../../utils";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

/**
 * Mounts whatever child a readable currently holds, and swaps it when that
 * value changes. `If` tests conditions and `Switch` matches values against
 * branches written out ahead of time; this takes the node itself from a
 * signal, which is what a component-in-a-signal wants to be.
 *
 * ```ts
 * const icon = derived([priority], (p) => PRIORITIES[p].icon());
 * Div(Dynamic(icon));
 *
 * // or without the intermediate readable
 * Div(Dynamic([priority], (p) => PRIORITIES[p].icon()));
 * ```
 *
 * The value is compared by identity, so a getter that builds a fresh mountable
 * per call swaps on every change of its sources, and one that returns a value
 * it already holds — the same mountable, the same string — leaves what is
 * mounted alone. Remounting the same value is `Key`'s job, not this one's.
 *
 * `null` and `undefined` render nothing. A value that is not a mountable is
 * the child it would be anywhere else: a string becomes text, a readable
 * becomes text that follows it.
 */
export function Dynamic(source: ReadableSource<Child>): Mountable;
export function Dynamic<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<Child, Signals>,
): Mountable;
export function Dynamic(
	sourceOrSignals: ReadableSource<Child> | readonly Readable<any>[],
	getter?: Getter<Child, readonly Readable<any>[]>,
): Mountable {
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Dynamic overload resolution requires narrowing a lone source from a tuple of them. */
	const lone = isReadable<Child>(sourceOrSignals) ? sourceOrSignals : null;
	const signals: readonly ReadableSource<any>[] =
		lone === null ? (sourceOrSignals as readonly Readable<any>[]) : [lone];
	const select: (...values: unknown[]) => Child =
		lone === null ? (getter as (...values: unknown[]) => Child) : (value) => value as Child;
	/* oxlint-enable typescript/no-unsafe-type-assertion */

	return () => {
		let parent: HTMLElement | null = null;
		let unsubscribe: Unsubscribe | null = null;
		let mounted: IMountable[] = [];
		/** The child currently mounted, and whether there is one to compare against. */
		let current: Child;
		let showing = false;
		const endMarker = dom.createComment("");
		let node: IMountable;

		const clear = () => {
			for (const child of mounted) child.unmount();
			mounted = [];
		};

		const show = (child: Child) => {
			clear();
			if (!parent) return;
			// `null` is the empty region, not an empty text node: a readable of a
			// node is routinely a readable of "no node yet", and a text node the
			// server never serialized is a hydration mismatch.
			if (child == null) return;

			asParent(node, () => {
				for (const factory of reconcileChildren({}, child)) {
					const instance = factory();
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

		const update = (...values: unknown[]) => {
			const next = select(...values);
			if (showing && next === current) return;
			current = next;
			showing = true;
			show(next);
		};

		node = {
			mount(p: HTMLElement) {
				unsubscribe?.();
				clear();
				showing = false;
				parent = p;
				dom.attach(parent, endMarker);
				unsubscribe = subscribe(signals, (...values: unknown[]) =>
					guarded(node, () => update(...values)),
				);
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				clear();
				showing = false;
				current = undefined;
				if (!isDetaching()) endMarker.remove();
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
	};
}
