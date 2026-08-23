import { dom, withInsertionAnchor } from "../../dom";
import { isReadable, subscribe, type Readable } from "../../signal";
import { asParent, guarded, mountChild, isDetaching } from "../../tree";
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
		// True once a branch has been mounted, which is what makes the next one a
		// re-mount into DOM that already has content after the marker.
		let remounting = false;
		const endMarker = dom.createComment("");
		let node: IMountable;

		const clear = () => {
			for (const child of mounted) child.unmount();
			mounted = [];
		};

		const remount = () => {
			clear();
			if (!parent) return;

			// A branch is appended past the end marker and put back by
			// `syncDomOrder`, which moves the first DOM node of each child — so a child
			// contributing several top-level nodes (an anchor comment and an element, say)
			// would leave the rest behind. On a re-mount there is DOM after the marker to
			// be left behind, so mount against it instead. The first mount cannot need
			// this: the whole tree is appended in order, and hydration claims in place.
			const mountBranch = () => {
				asParent(node, () => {
					for (const factory of reconcileChildren({}, ...children)) {
						const instance = factory();
						mounted.push(instance);
						mountChild(instance, parent!);
					}
				});
			};
			if (remounting) withInsertionAnchor(endMarker, mountBranch);
			else mountBranch();
			remounting = true;
			syncDomOrder(
				parent,
				mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
				endMarker,
			);
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
