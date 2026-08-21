import { dom } from "../dom";
import { beginHydration, endHydration } from "../hydrate";
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
	BindableReadable,
	ClassArray,
	ClassDictionary,
	ClassReadable,
	ClassValue,
	ComponentProps,
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
				node = dom.createTextNode(initial);
				dom.attach(parent, node);
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
				node = dom.createTextNode(toText(content.get()));
				dom.attach(parent, node);
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
		this.#element = dom.createElement(this.#tag) as HTMLElementTagNameMap[T];
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
		dom.attach(parent, this.#element);
		this.#props.this?.set(this.#element);
	}

	unmount(): void {
		this.#unsubscribeProps?.();
		this.#unsubscribeProps = null;
		// children unmount first so their `onUnmount` hooks still read this element
		this.#mountedChildren.forEach((child) => child.unmount());
		this.#mountedChildren = [];
		this.#props.this?.set(null);
		this.#element?.remove();
		this.#element = null;
	}

	getFirstDomNode(): Node | null {
		return this.#element;
	}
}

/**
 * Where a disposed app parks its mounted tree for whichever app mounts next.
 * It lives on the target element rather than in module state so the handoff
 * survives an update that replaces this module too — module state would reset
 * and strand the old tree in the document forever.
 */
const HANDOFF = Symbol.for("implementjs.hmrHandoff");

type HandoffTarget = HTMLElement & { [HANDOFF]?: () => void };

export function App(options: { target: HTMLElement }) {
	const { target } = options;
	const host = target as HandoffTarget;
	const roots = new Set<() => void>();

	const mountAll = (children: Child[], parent: HTMLElement): IMountable[] =>
		children.map((child) => {
			const instance = toMountable(child)();
			mountChild(instance, parent);
			return instance;
		});

	/** Sweep the server-injected head tags — the client `Head` recreates its own. */
	const sweepHead = () => {
		for (const el of Array.from(dom.head().querySelectorAll("[data-ssr]"))) el.remove();
	};

	return {
		/**
		 * Mounts `children` into the target and returns an unmount function.
		 * Server-rendered markup in the target (a `[data-ssr]` element) is
		 * hydrated: the mount adopts the existing nodes in place, so listeners
		 * and subscriptions attach without rebuilding the DOM. On a structural
		 * mismatch (client state diverged from the server render) the markup
		 * is discarded and mounted fresh in the same task — the browser never
		 * paints in between — restoring scroll because removing the old tree
		 * collapses the page height, which would clamp the scroll position.
		 *
		 * A tree handed over by an HMR-disposed app (see `unmount`) is swapped
		 * out here, once this mount is up, in that same single task.
		 */
		render: (...children: Child[]) => {
			let instances: IMountable[];
			let adopted: Element | null = null;
			// a handed-over tree is still on screen, so this mount appends after
			// it; remember where it ended to roll a failed mount back
			const handoff = host[HANDOFF];
			const mark = handoff === undefined ? -1 : target.childNodes.length;
			const ssr = target.querySelector("[data-ssr]");
			try {
				if (ssr) {
					beginHydration(ssr);
					let hydrated: IMountable[];
					try {
						hydrated = mountAll(children, ssr as HTMLElement);
					} catch (error) {
						endHydration();
						throw error;
					}
					if (endHydration()) {
						// adopted: the wrapper stays as the mount root; drop the
						// attribute so a second render cannot re-claim it
						ssr.removeAttribute("data-ssr");
						sweepHead();
						adopted = ssr;
						instances = hydrated;
					} else {
						console.warn(
							"hydration mismatch: discarding server-rendered markup and mounting fresh",
						);
						for (const instance of hydrated) {
							try {
								instance.unmount();
							} catch {
								// best-effort teardown of a partially adopted tree
							}
						}
						const { scrollX, scrollY } = window;
						ssr.remove();
						sweepHead();
						instances = mountAll(children, target);
						window.scrollTo(scrollX, scrollY);
					}
				} else {
					instances = mountAll(children, target);
				}
			} catch (error) {
				// the handed-over tree keeps the page painted, so drop whatever
				// this mount managed to build rather than leaving both on screen
				if (mark >= 0) {
					while (target.childNodes.length > mark) target.lastChild!.remove();
				}
				throw error;
			}
			const unmount = () => {
				roots.delete(unmount);
				instances.forEach((instance) => instance.unmount());
				// the adopted wrapper is the mount root, not one of the instances
				adopted?.remove();
			};
			roots.add(unmount);
			// only now that this render is up does the previous tree come down,
			// so the browser never paints the gap between them
			if (handoff !== undefined) {
				delete host[HANDOFF];
				handoff();
			}
			return unmount;
		},
		/**
		 * Unmounts every root this app has rendered.
		 *
		 * Pass it straight to `import.meta.hot.dispose`. Vite disposes the entry
		 * module *before* it imports the replacement, so tearing the tree down
		 * here would blank the page for however long that import takes — seconds
		 * on a large graph — and leave it blank for good if the replacement
		 * throws. Given the hot data Vite passes its dispose handlers, the app
		 * hands the live tree to whatever mounts next instead: the next `render`
		 * swaps it out once its own mount succeeded. Called with no argument
		 * (tests, manual teardown) it unmounts immediately.
		 */
		unmount: (hotData?: unknown) => {
			if (hotData === undefined) {
				roots.forEach((unmount) => unmount());
				return;
			}
			// chained, not replaced: a replacement that failed to mount is
			// disposed too, and its (empty) teardown must not strand the tree
			// still on screen
			const pending = host[HANDOFF];
			const mine = new Set(roots);
			host[HANDOFF] = () => {
				pending?.();
				mine.forEach((unmount) => unmount());
			};
		},
	};
}
