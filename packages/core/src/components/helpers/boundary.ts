import { dom } from "../../dom";
import { asParent, mountChild, parentOf, raiseError, registerBoundary } from "../../tree";
import { syncDomOrder, toError } from "../../utils";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

export type BoundaryHelper = Mountable & {
	Catch(render: (error: Error, reset: () => void) => Child): BoundaryHelper;
};

/**
 * Catches errors thrown while its subtree mounts or reacts to signal updates
 * and swaps in the `Catch` branch. `reset` remounts the children from scratch.
 * Without `Catch`, an error renders nothing.
 *
 * Covers synchronous mount errors and errors raised inside reactive helpers
 * (`If`, `ForEach`, `Switch`, `Key`, `Await`, `Portal`) and `Lifecycle.onMount`.
 * Event handlers and promise rejections are not routed here — handlers can
 * try/catch themselves, and async errors belong to `Await.Catch`.
 *
 * An error thrown by the `Catch` branch itself escalates to the next boundary
 * up rather than looping. The swap is deferred a microtask (it runs before
 * paint) so an error raised mid-mount never re-enters a mount pass already on
 * the stack.
 *
 * ```ts
 * Implement.Boundary(IssuePage(id)).Catch((error, reset) =>
 * 	Div(P(error.message), Button({ onClick: reset }, "Retry")),
 * );
 * ```
 */
export function Boundary(...children: Child[]): BoundaryHelper {
	let catchRender: ((error: Error, reset: () => void) => Child) | null = null;

	const helper: BoundaryHelper = Object.assign(
		(): IMountable => {
			let parent: HTMLElement | null = null;
			let mounted: IMountable[] = [];
			let showing: "children" | "catch" = "children";
			let pendingError: Error | null = null;
			const endMarker = dom.createComment("");
			let node: IMountable;

			const clear = () => {
				for (const child of mounted) {
					try {
						child.unmount();
					} catch {
						// best-effort teardown: the subtree may have failed mid-mount
					}
				}
				mounted = [];
			};

			const show = (branch: Child[]) => {
				clear();
				if (!parent) return;

				asParent(node, () => {
					for (const factory of reconcileChildren({}, ...branch)) {
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

			const fail = (error: Error) => {
				if (showing === "catch") {
					// the Catch branch itself failed — escalate to the next boundary up
					if (!raiseError(parentOf(node), error)) throw error;
					return;
				}
				if (pendingError) return;
				pendingError = error;
				queueMicrotask(() => {
					if (pendingError !== error || !parent) return;
					pendingError = null;
					showing = "catch";
					try {
						show(catchRender ? [catchRender(error, reset)] : []);
					} catch (catchError) {
						fail(toError(catchError));
					}
				});
			};

			const reset = () => {
				pendingError = null;
				showing = "children";
				try {
					show(children);
				} catch (error) {
					fail(toError(error));
				}
			};

			node = {
				mount(p: HTMLElement) {
					clear();
					parent = p;
					dom.attach(parent, endMarker);
					registerBoundary(node, fail);
					reset();
				},
				unmount() {
					pendingError = null;
					clear();
					showing = "children";
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
			Catch(render: (error: Error, reset: () => void) => Child) {
				catchRender = render;
				return helper;
			},
		},
	);

	return helper;
}
