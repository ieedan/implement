import { isReadable } from "../signal";
import { mountChild } from "../tree";
import type { Unsubscribe } from "../types";
import {
	applyElementProps,
	syncValueProp,
	type ElementChildArgs,
	type ElementProps,
} from "./props";
import type { Child, IMountable, Mountable, PrimitiveChild, ReadableChild } from "./types";

export type { Child, IMountable, Mountable, PrimitiveChild, ReadableChild } from "./types";
export type {
	AnchorTarget,
	AriaRole,
	AutoComplete,
	Bindable,
	ClassArray,
	ClassDictionary,
	ClassReadable,
	ClassValue,
	CrossOrigin,
	ElementChildArgs,
	ElementProps,
	ElementThis,
	FormEnctype,
	FormMethod,
	HttpEquiv,
	InputType,
	LinkAs,
	MetaName,
	PreserveAspectRatio,
	Props,
	ReferrerPolicy,
	RelType,
	Sandbox,
	Styles,
	VoidHTMLElement,
} from "./props";

export type ComponentFactory<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
	() => Component<T>;

function toText(value: PrimitiveChild): string {
	if (value == null || value === false) return "";
	return typeof value === "string" ? value : `${value}`;
}

function text(content: PrimitiveChild): Mountable {
	const initial = toText(content);
	return () => {
		let node: Text | null = null;
		return {
			mount(parent: HTMLElement) {
				node = document.createTextNode(initial);
				parent.appendChild(node);
			},
			unmount() {
				node?.remove();
				node = null;
			},
			getFirstDomNode() {
				return node;
			},
		};
	};
}

function readableText(content: ReadableChild): Mountable {
	return () => {
		let node: Text | null = null;
		let unsubscribe: Unsubscribe | null = null;
		return {
			mount(parent: HTMLElement) {
				node = document.createTextNode(toText(content.get()));
				parent.appendChild(node);
				unsubscribe = content.subscribe((value) => {
					if (node) node.data = toText(value);
				});
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				node?.remove();
				node = null;
			},
			getFirstDomNode() {
				return node;
			},
		};
	};
}

function toMountable(child: Child): Mountable {
	if (typeof child === "function") return child;
	if (child !== null && typeof child === "object" && isReadable<PrimitiveChild>(child)) {
		return readableText(child);
	}
	return text(child as PrimitiveChild);
}

export function component<T extends keyof HTMLElementTagNameMap>(
	tag: T,
	props: ElementProps<T> = {} as ElementProps<T>,
	...children: ElementChildArgs<T>
): ComponentFactory<T> {
	return () => new Component(tag, props, ...children);
}

export function element<T extends keyof HTMLElementTagNameMap>(tag: T) {
	return (
		props: ElementProps<T> = {} as ElementProps<T>,
		...children: ElementChildArgs<T>
	): ComponentFactory<T> => component(tag, props, ...children);
}

export function reconcileChildren(
	props: { children?: Child | Child[] },
	...children: Child[]
): Mountable[] {
	const fromProps = props.children
		? Array.isArray(props.children)
			? props.children
			: [props.children]
		: [];
	return [...fromProps, ...children].map(toMountable);
}

class Component<T extends keyof HTMLElementTagNameMap> implements IMountable {
	#element: HTMLElementTagNameMap[T] | null = null;
	#tag: T;
	#props: ElementProps<T>;
	#children: Mountable[];
	#mountedChildren: IMountable[] = [];
	#unsubscribeProps: Unsubscribe | null = null;

	constructor(tag: T, props: ElementProps<T>, ...children: ElementChildArgs<T>) {
		this.#tag = tag;
		this.#props = props;
		this.#children = reconcileChildren(props, ...children);
	}

	mount(parent: HTMLElement): void {
		this.#element = document.createElement(this.#tag);
		this.#unsubscribeProps = applyElementProps(
			this.#element,
			this.#tag,
			this.#props as Record<string, unknown>,
		);
		this.#children.forEach((child) => {
			const createdChild = child();
			this.#mountedChildren.push(createdChild);
			mountChild(createdChild, this.#element!);
		});
		syncValueProp(this.#element, this.#props as Record<string, unknown>);
		parent.appendChild(this.#element);
		this.#props.this?.set(this.#element);
	}

	unmount(): void {
		this.#props.this?.set(null);
		this.#unsubscribeProps?.();
		this.#unsubscribeProps = null;
		this.#mountedChildren.forEach((child) => child.unmount());
		this.#mountedChildren = [];
		this.#element?.remove();
		this.#element = null;
	}

	getFirstDomNode(): Node | null {
		return this.#element;
	}
}

export function App(options: { target: HTMLElement }) {
	const { target } = options;

	return {
		render: (...children: Child[]) => {
			children.forEach((child) => mountChild(toMountable(child)(), target));
		},
	};
}
