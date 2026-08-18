import { isReadable, subscribe, type Readable } from "../../signal";
import { asParent, guarded, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { syncDomOrder } from "../../utils";
import { reconcileChildren } from "..";
import type { Bindable } from "../props";
import type { Child, IMountable, Mountable } from "../types";

export type PortalProps = {
	to?: HTMLElement | Readable<HTMLElement>;
	disabled?: Bindable<boolean>;
	children?: Child | Child[];
};

export type PortalHelper = Mountable & {
	To(target: HTMLElement | Readable<HTMLElement>): PortalHelper;
	Disabled(disabled: Bindable<boolean>): PortalHelper;
};

function isPortalProps(value: unknown): value is PortalProps {
	if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
	if ("get" in value && "subscribe" in value) return false;
	return true;
}

/**
 * Mounts children into another element (`document.body` by default), escaping
 * ancestor stacking and overflow. They stay in the logical tree, so context
 * and unmounting still behave as if they rendered in place.
 *
 * `disabled` mounts children in the parent instead of teleporting them.
 *
 * ```ts
 * Portal(DialogPanel()).To(document.body);
 * Portal({ to: overlayRoot, disabled: nested }, DialogPanel());
 * ```
 */
export function Portal(props: PortalProps, ...children: Child[]): PortalHelper;
export function Portal(...children: Child[]): PortalHelper;
export function Portal(propsOrChild?: PortalProps | Child, ...rest: Child[]): PortalHelper {
	let to: HTMLElement | Readable<HTMLElement> | undefined;
	let disabled: Bindable<boolean> | undefined;
	let children: Child[];

	if (isPortalProps(propsOrChild)) {
		to = propsOrChild.to;
		disabled = propsOrChild.disabled;
		const fromProps = propsOrChild.children
			? Array.isArray(propsOrChild.children)
				? propsOrChild.children
				: [propsOrChild.children]
			: [];
		children = [...fromProps, ...rest];
	} else {
		children = propsOrChild === undefined ? rest : [propsOrChild, ...rest];
	}

	const helper: PortalHelper = Object.assign(
		(): IMountable => {
			let unsubscribe: Unsubscribe | null = null;
			let mounted: IMountable[] = [];
			let parent: HTMLElement | null = null;
			const endMarker = document.createComment("");
			let node: IMountable;

			const isDisabled = () => {
				if (disabled === undefined) return false;
				return isReadable<boolean>(disabled) ? Boolean(disabled.get()) : Boolean(disabled);
			};

			const targetOf = () => {
				if (isDisabled()) return parent ?? document.body;
				if (!to) return document.body;
				return isReadable<HTMLElement>(to) ? to.get() : to;
			};

			const clear = () => {
				for (const child of mounted) child.unmount();
				mounted = [];
			};

			const mountInto = (target: HTMLElement) => {
				clear();
				asParent(node, () => {
					for (const child of reconcileChildren({}, ...children)) {
						const instance = child();
						mounted.push(instance);
						mountChild(instance, target);
					}
				});
				if (isDisabled() && parent) {
					syncDomOrder(
						parent,
						mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
						endMarker,
					);
				}
			};

			node = {
				mount(p: HTMLElement) {
					unsubscribe?.();
					clear();
					parent = p;
					parent.appendChild(endMarker);
					const signals: Readable<unknown>[] = [];
					if (isReadable(to)) signals.push(to);
					if (isReadable(disabled)) signals.push(disabled);
					unsubscribe = subscribe(signals, () => guarded(node, () => mountInto(targetOf())));
				},
				unmount() {
					unsubscribe?.();
					unsubscribe = null;
					clear();
					endMarker.remove();
					parent = null;
				},
				getFirstDomNode() {
					if (isDisabled()) {
						for (const child of mounted) {
							const first = child.getFirstDomNode();
							if (first) return first;
						}
					}
					return endMarker.isConnected ? endMarker : null;
				},
			};
			return node;
		},
		{
			To(target: HTMLElement | Readable<HTMLElement>) {
				to = target;
				return helper;
			},
			Disabled(value: Bindable<boolean>) {
				disabled = value;
				return helper;
			},
		},
	);

	return helper;
}
