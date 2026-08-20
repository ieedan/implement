import { teardownAll } from "../../exit";
import { isReadable } from "../../signal";
import { mountChild } from "../../tree";
import { reconcileChildren } from "..";
import type { Child, IMountable } from "../types";

export type FragmentProps = {
	children?: Child | Child[];
};

function isFragmentProps(value: unknown): value is FragmentProps {
	return value != null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}

/**
 * Groups siblings without a wrapper element.
 *
 * ```ts
 * Fragment(Dt(term), Dd(definition));
 * Fragment({ children: Dt(term) }, Dd(definition));
 * ```
 */
export function Fragment(...children: Child[]): Child;
export function Fragment(props: FragmentProps, ...children: Child[]): Child;
export function Fragment(propsOrChild?: FragmentProps | Child, ...rest: Child[]): Child {
	let props: FragmentProps;
	let children: Child[];

	if (isFragmentProps(propsOrChild)) {
		props = propsOrChild;
		children = rest;
	} else {
		props = {};
		children = propsOrChild === undefined ? rest : [propsOrChild, ...rest];
	}

	return () => {
		const childrenArray = reconcileChildren(props, ...children);
		const mountedChildren: IMountable[] = [];
		return {
			mount: (parent: HTMLElement) => {
				mountedChildren.length = 0;
				childrenArray.forEach((child) => {
					const createdChild = child();
					mountedChildren.push(createdChild);
					mountChild(createdChild, parent);
				});
			},
			unmount: () => {
				teardownAll(mountedChildren);
			},
			getFirstDomNode: () => {
				for (const child of mountedChildren) {
					const node = child.getFirstDomNode();
					if (node) return node;
				}
				return null;
			},
		};
	};
}
