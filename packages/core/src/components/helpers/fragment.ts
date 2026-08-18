import { mountChild } from "../../tree";
import { reconcileChildren } from "..";
import type { Child, IMountable } from "../types";

export type FragmentProps = {
	children?: Child | Child[];
};

export function Fragment(props: FragmentProps = {}, ...children: Child[]): Child {
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
				mountedChildren.forEach((child) => child.unmount());
				mountedChildren.length = 0;
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
