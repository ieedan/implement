import { dom, withInsertionAnchor } from "../../dom";
import { isReadable, subscribe, type Readable } from "../../signal";
import { asParent, guarded, mountChild, isDetaching } from "../../tree";
import type { Unsubscribe } from "../../types";
import { placeRegionEnd } from "./region";
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
		const endMarker = dom.createComment("");
		let node: IMountable;

		const clear = () => {
			for (const child of mounted) child.unmount();
			mounted = [];
		};

		const remount = () => {
			clear();
			if (!parent) return;

			asParent(node, () => {
				// Anchored to the end marker, so every node the branch mounts lands
				// inside the region it bounds and leaves with it — see the insertion
				// anchor in `dom` for what being appended past it costs.
				withInsertionAnchor(endMarker, () => {
					for (const factory of reconcileChildren({}, ...children)) {
						const instance = factory();
						mounted.push(instance);
						mountChild(instance, parent!);
					}
				});
			});
			placeRegionEnd(parent, endMarker);
		};

		node = {
			mount(p: HTMLElement) {
				unsubscribe?.();
				clear();
				parent = p;
				dom.attach(parent, endMarker);
				unsubscribe = subscribe(signals, () => guarded(node, remount));
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				clear();
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
