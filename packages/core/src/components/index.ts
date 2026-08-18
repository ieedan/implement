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

function isPropsObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}

export function element<T extends keyof HTMLElementTagNameMap>(tag: T) {
	function factory(...children: ElementChildArgs<T>): ComponentFactory<T>;
	function factory(props: ElementProps<T>, ...children: ElementChildArgs<T>): ComponentFactory<T>;
	function factory(propsOrChild?: ElementProps<T> | Child, ...rest: Child[]): ComponentFactory<T> {
		if (isPropsObject(propsOrChild)) {
			return component(tag, propsOrChild as ElementProps<T>, ...(rest as ElementChildArgs<T>));
		}
		const children = (
			propsOrChild === undefined ? rest : [propsOrChild, ...rest]
		) as ElementChildArgs<T>;
		return component(tag, {} as ElementProps<T>, ...children);
	}
	return factory;
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
	const roots = new Set<() => void>();

	return {
		/** Mounts `children` into the target and returns an unmount function. */
		render: (...children: Child[]) => {
			const instances = children.map((child) => {
				const instance = toMountable(child)();
				mountChild(instance, target);
				return instance;
			});
			const unmount = () => {
				roots.delete(unmount);
				instances.forEach((instance) => instance.unmount());
			};
			roots.add(unmount);
			return unmount;
		},
		/**
		 * Unmounts every root this app has rendered. An app entry passes this to
		 * `import.meta.hot.dispose` so the old tree is torn down before the
		 * updated entry module re-executes and mounts a fresh one.
		 */
		unmount: () => {
			roots.forEach((unmount) => unmount());
		},
	};
}
