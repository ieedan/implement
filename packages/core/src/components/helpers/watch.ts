import { subscribe, type Getter, type Readable } from "../../signal";
import { guarded } from "../../tree";
import type { Unsubscribe } from "../../types";
import type { IMountable, Mountable } from "../types";

export type EffectOptions = {
	/**
	 * Run the effect on mount with the current values. `false` skips that first
	 * run so the effect only fires on later changes, the way a readable's own
	 * `subscribe`/`onChange` behave. Defaults to `true`.
	 */
	immediate?: boolean;
};

/**
 * Runs an effect for as long as it is mounted, so effect lifetime follows tree
 * position with no cleanup to write. Like `watch`, the effect runs immediately
 * on mount with the current values, then again whenever any source changes;
 * unmounting unsubscribes. Pass `{ immediate: false }` to skip the run on mount
 * and react to changes only. Renders nothing.
 *
 * ```ts
 * ImplementEffect([query], (q) => localStorage.setItem("q", q));
 *
 * ImplementEffect([id], (id) => refetch(id), { immediate: false });
 * ```
 */
export function ImplementEffect<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	effect: Getter<void, Signals>,
	options: EffectOptions = {},
): Mountable {
	const immediate = options.immediate ?? true;
	return () => {
		let unsubscribe: Unsubscribe | null = null;
		const node: IMountable = {
			mount() {
				unsubscribe?.();
				// `subscribe` delivers the current values synchronously before it
				// returns; that call is the run this flag skips. Later changes always
				// arrive after subscription, so they are never swallowed.
				let priming = !immediate;
				unsubscribe = subscribe(signals, (...values) => {
					if (priming) return;
					guarded(node, () => effect(...values));
				});
				priming = false;
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
