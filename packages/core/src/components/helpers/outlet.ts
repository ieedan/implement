import { dom } from "../../dom";
import { asParent, isDetaching, mountChild } from "../../tree";
import { syncDomOrder } from "../../utils";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

export type OutletHelper = Mountable & {
	/**
	 * Replace what the outlet shows. The previous children unmount first, so
	 * their subscriptions and effects end before the new ones mount.
	 *
	 * Mounting is synchronous, and whatever the new children throw comes back
	 * out of this call — an enclosing `ImplementBoundary` only sees it when the
	 * outlet is mounting itself. Callers driving an outlet from a subscription
	 * (a router reacting to `location`) own that error: catch it and `set` a
	 * fallback, or put an `ImplementBoundary` inside the children.
	 */
	set(...children: Child[]): void;
};

/**
 * A swappable mount region: children mount at its position in the tree, and
 * `set` replaces them without disturbing anything around it. The building
 * block for control-flow nodes that decide imperatively what to show — a
 * router hands each layout an outlet as its child and `set`s the matched route
 * into it, so navigating swaps the route without remounting the layout.
 *
 * Everything a child gets from being in the tree, it gets here: `context()`
 * lookups walk through the outlet to enclosing providers, errors reach the
 * nearest `ImplementBoundary`, and mounting inside a server render or a
 * hydration pass goes through the same path as any other child.
 *
 * ```ts
 * const outlet = Outlet(Spinner());
 * const page = Div({ class: "shell" }, outlet);
 * load().then((data) => outlet.set(Report(data)));
 * ```
 */
export function Outlet(...initial: Child[]): OutletHelper {
	let children: Child[] = initial;
	let parent: HTMLElement | null = null;
	let mounted: IMountable[] = [];
	// Created with the node rather than with the helper: `Outlet()` at module
	// scope must not reach for a document that a server render has not
	// installed yet.
	let endMarker: Comment | null = null;
	let node: IMountable | null = null;

	const clear = () => {
		for (const child of mounted) child.unmount();
		mounted = [];
	};

	const render = () => {
		clear();
		asParent(node!, () => {
			for (const factory of reconcileChildren({}, ...children)) {
				const instance = factory();
				mounted.push(instance);
				mountChild(instance, parent!);
			}
		});
		syncDomOrder(
			parent!,
			mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
			endMarker,
		);
	};

	return Object.assign(
		(): IMountable => {
			// One node per outlet, however many times the mountable is invoked:
			// `set` writes to the region, and the region is the outlet itself.
			if (node === null) {
				const marker = dom.createComment("");
				endMarker = marker;
				node = {
					mount(p: HTMLElement) {
						parent = p;
						dom.attach(p, marker);
						render();
					},
					unmount() {
						clear();
						if (!isDetaching()) marker.remove();
						parent = null;
					},
					getFirstDomNode() {
						for (const child of mounted) {
							const first = child.getFirstDomNode();
							if (first) return first;
						}
						return marker.isConnected ? marker : null;
					},
				};
			}
			return node;
		},
		{
			set(...next: Child[]) {
				children = next;
				if (parent) render();
			},
		},
	);
}
