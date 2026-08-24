import { dom, withInsertionAnchor } from "../../dom";
import { isReadable, subscribe, type Getter, type Readable } from "../../signal";
import { asParent, guarded, mountChild, isDetaching } from "../../tree";
import type { Unsubscribe } from "../../types";
import { placeRegionEnd } from "./region";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

type IfCondition = boolean | Readable<any> | readonly Readable<any>[];

type IfBranch = {
	signals: readonly Readable<any>[];
	getCondition: () => boolean;
	children: Child[];
};

function isChild(value: unknown): value is Child {
	if (value == null) return true;
	switch (typeof value) {
		case "string":
		case "number":
		case "boolean":
		case "function":
			return true;
		case "object":
			return "get" in value && "subscribe" in value;
		default:
			return false;
	}
}

function collectChildren(first: unknown, rest: Child[]): Child[] {
	if (first === undefined) return rest;
	if (!isChild(first)) return rest;
	return [first, ...rest];
}

function parseBranch(
	condition: IfCondition,
	getterOrChild?: unknown,
	rest: Child[] = [],
): IfBranch {
	if (typeof condition === "boolean") {
		return {
			signals: [],
			getCondition: () => condition,
			children: collectChildren(getterOrChild, rest),
		};
	}

	if (isReadable<any>(condition)) {
		return {
			signals: [condition],
			getCondition: () => Boolean(condition.get()),
			children: collectChildren(getterOrChild, rest),
		};
	}

	return {
		signals: condition,
		getCondition: () => {
			if (typeof getterOrChild !== "function") return false;
			return Boolean(getterOrChild(...condition.map((signal) => signal.get())));
		},
		children: rest,
	};
}

export type IfHelper = Mountable & {
	Then(...children: Child[]): IfHelper;
	ElseIf(condition: boolean | Readable<any>, ...children: Child[]): IfHelper;
	ElseIf<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<boolean, Signals>,
		...children: Child[]
	): IfHelper;
	Else(...children: Child[]): IfHelper;
};

/**
 * A signal passed on its own is checked for truthiness, so
 * `If(user, Profile(user))` is enough when the intent is `user !== null`.
 *
 * Children are the same factories as everywhere else (`Div(...)`, etc.).
 * They are instantiated while the branch is shown and discarded when it hides.
 *
 * Branches chain: `If(a, A()).ElseIf(b, B()).Else(C())` mounts the first
 * branch whose condition holds.
 */
export function If(condition: boolean | Readable<any>, ...children: Child[]): IfHelper;
export function If<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<boolean, Signals>,
	...children: Child[]
): IfHelper;
export function If(condition: IfCondition, getterOrChild?: unknown, ...rest: Child[]): IfHelper {
	const branches: IfBranch[] = [parseBranch(condition, getterOrChild, rest)];
	let elseChildren: Child[] = [];

	const helper: IfHelper = Object.assign(
		(): IMountable => {
			let parent: HTMLElement | null = null;
			let unsubscribe: Unsubscribe | null = null;
			let showing: number | "else" | null = null;
			let mounted: IMountable[] = [];
			const endMarker = dom.createComment("");

			const childrenFor = (target: number | "else"): Child[] =>
				target === "else" ? elseChildren : branches[target]!.children;

			const clear = () => {
				for (const child of mounted) child.unmount();
				mounted = [];
			};

			let node: IMountable;

			const show = (target: number | "else") => {
				if (showing === target) return;
				clear();
				showing = target;
				if (!parent) return;

				asParent(node, () => {
					// Anchored to the end marker, so every node the branch mounts lands
					// inside the region it bounds and leaves with it — see the insertion
					// anchor in `dom` for what being appended past it costs.
					withInsertionAnchor(endMarker, () => {
						for (const child of reconcileChildren({}, ...childrenFor(target))) {
							const instance = child();
							mounted.push(instance);
							mountChild(instance, parent!);
						}
					});
				});
				placeRegionEnd(parent, endMarker);
			};

			const reconcile = () => {
				let target: number | "else" = "else";
				for (let i = 0; i < branches.length; i++) {
					if (branches[i]!.getCondition()) {
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
					unsubscribe = subscribe(
						branches.flatMap((branch) => branch.signals),
						() => guarded(node, reconcile),
					);
				},
				unmount() {
					unsubscribe?.();
					unsubscribe = null;
					clear();
					showing = null;
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
		},
		{
			Then(...children: Child[]) {
				branches[branches.length - 1]!.children = children;
				return helper;
			},
			ElseIf(condition: IfCondition, getterOrChild?: unknown, ...rest: Child[]) {
				branches.push(parseBranch(condition, getterOrChild, rest));
				return helper;
			},
			Else(...children: Child[]) {
				elseChildren = children;
				return helper;
			},
		},
	);

	return helper;
}
