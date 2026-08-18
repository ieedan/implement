import { subscribe, type Getter, type Readable } from "../../signal";
import { guarded } from "../../tree";
import type { Unsubscribe } from "../../types";
import type { IMountable, Mountable } from "../types";

/**
 * Runs an effect for as long as it is mounted, so effect lifetime follows tree
 * position with no cleanup to write. Like `watch`, the effect runs immediately
 * on mount with the current values, then again whenever any source changes;
 * unmounting unsubscribes. Renders nothing.
 *
 * ```ts
 * Implement.Watch([query], (q) => localStorage.setItem("q", q));
 * ```
 */
export function Watch<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	effect: Getter<void, Signals>,
): Mountable {
	return () => {
		let unsubscribe: Unsubscribe | null = null;
		const node: IMountable = {
			mount() {
				unsubscribe?.();
				unsubscribe = subscribe(signals, (...values) => {
					guarded(node, () => effect(...values));
				});
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
			},
			getFirstDomNode() {
				// no DOM of its own; logical siblings must never anchor against it
				return null;
			},
		};
		return node;
	};
}
