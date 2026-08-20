import { forceUnmount, registerExit, type ExitHook } from "../../exit";
import { guarded, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

export type LifecycleProps = {
	/**
	 * Runs after the mount pass has finished, once the subtree is connected to
	 * the document (safe to focus/measure). May return a cleanup, which runs on
	 * unmount alongside `onUnmount`.
	 */
	onMount?: (parent: HTMLElement) => void | (() => void);
	/**
	 * Runs while this subtree is leaving, before anything leaves the DOM.
	 * Removal — an `If` hiding a branch, a `ForEach` dropping a row, a route
	 * swap, any ancestor going away — waits for the returned promise, so this
	 * is where an exit animation goes. The nodes are still on screen and the
	 * subtree is still live while it runs.
	 *
	 * `signal` aborts when the exit is cancelled: the subtree came back (the
	 * branch re-shown, the key re-added) and stays mounted, or the tree is
	 * being torn down and goes immediately. Stop the animation when it fires.
	 *
	 * A no-op during a server render, like `onMount`.
	 *
	 * ```ts
	 * Implement.Lifecycle({
	 * 	onExit: (signal) => {
	 * 		const animation = animate(panel.get()!, { opacity: 0 }, { duration: 0.2 });
	 * 		signal.addEventListener("abort", () => animation.stop());
	 * 		return animation;
	 * 	},
	 * });
	 * ```
	 */
	onExit?: ExitHook;
	/** Runs synchronously at the start of unmount, while children are still in the DOM. */
	onUnmount?: () => void;
	children?: Child | Child[];
};

/**
 * Hooks into mount/unmount at its position in the tree. Mounted standalone it
 * reacts to its own lifecycle (and renders nothing); given children it owns
 * them, so the hooks fire with the wrapped subtree's lifecycle.
 *
 * `onMount` is deferred a microtask so the document is connected; a returned
 * cleanup runs on unmount. Hooks track this node's own mount/unmount only —
 * an `If` toggling branches inside the children does not re-fire them.
 *
 * ```ts
 * Implement.Lifecycle({ onMount: (el) => el.querySelector("input")?.focus() });
 *
 * Implement.Lifecycle(
 * 	{ onMount: () => id.onChange(refetch) },
 * 	IssueView(id),
 * );
 * ```
 */
export function Lifecycle(props: LifecycleProps = {}, ...children: Child[]): Mountable {
	return () => {
		const childrenArray = reconcileChildren(props, ...children);
		let mounted: IMountable[] = [];
		let cleanup: (() => void) | null = null;
		let unregisterExit: Unsubscribe | null = null;
		let cancelled = false;

		const node: IMountable = {
			mount(parent: HTMLElement) {
				cancelled = false;
				mounted = [];
				if (props.onExit) unregisterExit = registerExit(props.onExit);
				for (const child of childrenArray) {
					const instance = child();
					mounted.push(instance);
					mountChild(instance, parent);
				}
				queueMicrotask(() => {
					if (cancelled) return;
					guarded(node, () => {
						cleanup = props.onMount?.(parent) ?? null;
					});
				});
			},
			unmount() {
				cancelled = true;
				unregisterExit?.();
				unregisterExit = null;
				props.onUnmount?.();
				cleanup?.();
				cleanup = null;
				for (const child of mounted) forceUnmount(child);
				mounted = [];
			},
			getFirstDomNode() {
				for (const child of mounted) {
					const first = child.getFirstDomNode();
					if (first) return first;
				}
				// standalone: no DOM of its own; logical siblings must never anchor against it
				return null;
			},
		};
		return node;
	};
}
