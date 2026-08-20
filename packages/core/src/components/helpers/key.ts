import { dom } from "../../dom";
import { exitingNodes, firstExitingNode, removeChildren, teardownChildren } from "../../exit";
import { isReadable, subscribe, type Readable } from "../../signal";
import { asParent, guarded, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { syncDomOrder } from "../../utils";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

/**
 * Forces a full remount of `children` whenever the watched signal(s) change.
 * Pass a component that already closes over reactive values — Key does not
 * unwrap them. Use this when in-place updates are not enough and you need a
 * fresh instance (local state reset, effects re-run, etc.).
 *
 * ```ts
 * Key(route, PageFor(route));
 * Key([route, issues], PageFor(route, issues));
 * ```
 */
export function Key(signal: Readable<any>, ...children: Child[]): Mountable;
export function Key(signals: readonly Readable<any>[], ...children: Child[]): Mountable;
export function Key(
	signalOrSignals: Readable<any> | readonly Readable<any>[],
	...children: Child[]
): Mountable {
	const signals: readonly Readable<any>[] = isReadable<any>(signalOrSignals)
		? [signalOrSignals]
		: signalOrSignals;

	return () => {
		let parent: HTMLElement | null = null;
		let unsubscribe: Unsubscribe | null = null;
		let mounted: IMountable[] = [];
		/** The previous instance, animating out while the fresh one mounts. */
		const exiting: IMountable[] = [];
		const endMarker = dom.createComment("");
		let node: IMountable;

		const clear = () => {
			removeChildren(mounted, exiting);
			mounted = [];
		};

		const remount = () => {
			clear();
			if (!parent) return;

			asParent(node, () => {
				for (const factory of reconcileChildren({}, ...children)) {
					const instance = factory();
					mounted.push(instance);
					mountChild(instance, parent!);
				}
			});
			syncDomOrder(
				parent,
				[
					...exitingNodes(exiting),
					...mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
				],
				endMarker,
			);
		};

		node = {
			mount(p: HTMLElement) {
				unsubscribe?.();
				teardownChildren(mounted, exiting);
				parent = p;
				dom.attach(parent, endMarker);
				unsubscribe = subscribe(signals, () => guarded(node, remount));
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				teardownChildren(mounted, exiting);
				endMarker.remove();
				parent = null;
			},
			getFirstDomNode() {
				const leaving = firstExitingNode(exiting);
				if (leaving) return leaving;
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
