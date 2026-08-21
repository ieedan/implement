import { dom } from "../dom";
import { beginHydration, describeMismatch, endHydration, withMountParent } from "../hydrate";
import { isReadable } from "../signal";
import { beginDetach, beginDiscard, endDetach, endDiscard, isDetaching, mountChild } from "../tree";
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
	OneWayBindable,
	TwoWayBindable,
	MaybeTwoWayBindable,
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

/**
 * A static text node. A class rather than an object literal of closures
 * because a row of this app carries four text children and a ten-thousand-row
 * list therefore forty thousand of them — one object against one object plus
 * three closures, forty thousand times over.
 */
class StaticText implements IMountable {
	#node: Text | null = null;
	#initial: string;

	constructor(initial: string) {
		this.#initial = initial;
	}

	mount(parent: HTMLElement): void {
		this.#node = dom.createTextNode(this.#initial);
		dom.attach(parent, this.#node);
	}

	unmount(): void {
		if (!isDetaching()) this.#node?.remove();
		this.#node = null;
	}

	getFirstDomNode(): Node | null {
		return this.#node;
	}
}

/** A text node that follows a readable. One closure at mount, not three at creation. */
class LiveText implements IMountable {
	#node: Text | null = null;
	#content: ReadableChild;
	#unsubscribe: Unsubscribe | null = null;

	constructor(content: ReadableChild) {
		this.#content = content;
	}

	mount(parent: HTMLElement): void {
		this.#node = dom.createTextNode(toText(this.#content.get()));
		dom.attach(parent, this.#node);
		this.#unsubscribe = this.#content.subscribe((value) => {
			if (this.#node) this.#node.data = toText(value);
		});
	}

	unmount(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		if (!isDetaching()) this.#node?.remove();
		this.#node = null;
	}

	getFirstDomNode(): Node | null {
		return this.#node;
	}
}

function text(content: PrimitiveChild): Mountable {
	const initial = toText(content);
	return () => new StaticText(initial);
}

function readableText(content: ReadableChild): Mountable {
	return () => new LiveText(content);
}

function toMountable(child: Child): Mountable {
	if (typeof child === "function") return child;
	if (child !== null && typeof child === "object" && isReadable<PrimitiveChild>(child)) {
		return readableText(child);
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Child unions include mountables; text nodes are the remaining primitive case.
	return text(child as PrimitiveChild);
}

export function component<T extends keyof HTMLElementTagNameMap>(
	tag: T,
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Empty props default for the props-then-children call shape.
	props: ElementProps<T> = {} as ElementProps<T>,
	...children: ElementChildArgs<T>
): ComponentFactory<T> {
	return () => new Component(tag, props, ...children);
}

function isPropsObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}

function createElementComponent<T extends keyof HTMLElementTagNameMap>(
	tag: T,
	propsOrChild?: ElementProps<T> | Child,
	...rest: Child[]
): ComponentFactory<T> {
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Element overload resolution requires narrowing props vs. children. */
	if (isPropsObject(propsOrChild)) {
		return component(tag, propsOrChild as ElementProps<T>, ...(rest as ElementChildArgs<T>));
	}
	const children = (
		propsOrChild === undefined ? rest : [propsOrChild, ...rest]
	) as ElementChildArgs<T>;
	return component(tag, {} as ElementProps<T>, ...children);
	/* oxlint-enable typescript/no-unsafe-type-assertion */
}

export function element<T extends keyof HTMLElementTagNameMap>(tag: T) {
	function factory(...children: ElementChildArgs<T>): ComponentFactory<T>;
	function factory(props: ElementProps<T>, ...children: ElementChildArgs<T>): ComponentFactory<T>;
	function factory(propsOrChild?: ElementProps<T> | Child, ...rest: Child[]): ComponentFactory<T> {
		return createElementComponent(tag, propsOrChild, ...rest);
	}
	return factory;
}

export function reconcileChildren(
	props: { children?: Child | Child[] },
	...children: Child[]
): Mountable[] {
	// The overwhelmingly common shape is children as arguments and no `children`
	// prop. Falsy rather than undefined, matching what the concatenation did
	// before: `children: null` contributes nothing, it does not become an empty
	// text node.
	if (!props.children) {
		// Children that are already mountables map to themselves, so the rest-args
		// array — which this call owns — is the result. One array per element with
		// children, saved, on a path that runs once per element in the tree.
		for (const child of children) {
			if (typeof child !== "function") return children.map(toMountable);
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Every entry was just checked to be a mountable factory.
		return children as Mountable[];
	}
	const fromProps = Array.isArray(props.children) ? props.children : [props.children];
	return [...fromProps, ...children].map(toMountable);
}

const NO_CHILDREN: Mountable[] = [];

class Component<T extends keyof HTMLElementTagNameMap> implements IMountable {
	#element: HTMLElementTagNameMap[T] | null = null;
	#tag: T;
	#props: ElementProps<T>;
	#children: Mountable[];
	/**
	 * An element whose whole content is one readable — `Span(issue.bind("title"))`
	 * — owns its text node directly instead of mounting a child for it. Three of
	 * the ten mountables in this comparison's list row are exactly that shape, so
	 * skipping them is 30% fewer objects to create, track and tear down per row.
	 */
	#textChild: ReadableChild | null = null;
	#textNode: Text | null = null;
	#unsubscribeText: Unsubscribe | null = null;
	#mountedChildren: IMountable[] | null = null;
	#unsubscribeProps: Unsubscribe | null = null;

	constructor(tag: T, props: ElementProps<T>, ...children: ElementChildArgs<T>) {
		this.#tag = tag;
		this.#props = props;
		const lone = props.children === undefined && children.length === 1 ? children[0] : undefined;
		if (lone !== null && typeof lone === "object" && isReadable<PrimitiveChild>(lone)) {
			this.#textChild = lone;
			this.#children = NO_CHILDREN;
			return;
		}
		this.#children = reconcileChildren(props, ...children);
	}

	mount(parent: HTMLElement): void {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- createElement returns HTMLElement; the tag generic selects the concrete member.
		this.#element = dom.createElement(this.#tag) as HTMLElementTagNameMap[T];
		this.#unsubscribeProps = applyElementProps(this.#element, this.#tag, this.#props);
		if (this.#textChild !== null) {
			const content = this.#textChild;
			const host = this.#element;
			// The parent scope `mountChild` would have established, so a hydration
			// pass claims the serialized text node in place rather than hunting for
			// it under this element's own parent.
			withMountParent(host, () => {
				const node = dom.createTextNode(toText(content.get()));
				this.#textNode = node;
				dom.attach(host, node);
			});
			const node = this.#textNode;
			if (node !== null) {
				this.#unsubscribeText = content.subscribe((value) => {
					node.data = toText(value);
				});
			}
		}
		for (const child of this.#children) {
			const createdChild = child();
			// Allocated on the first child, so a void element never carries one.
			(this.#mountedChildren ??= []).push(createdChild);
			mountChild(createdChild, this.#element);
		}
		syncValueProp(this.#element, this.#props);
		dom.attach(parent, this.#element);
		this.#props.this?.set(this.#element);
	}

	unmount(): void {
		// Whether an ancestor is already taking this element out of the document,
		// read before the flags below change it.
		const detached = isDetaching();
		// Everything from here down is being thrown away, which is what lets the
		// prop teardown skip work whose only purpose is to leave a live node tidy;
		// and removing this element takes its children with it, so they skip their
		// own removal too.
		beginDiscard();
		beginDetach();
		try {
			this.#unsubscribeProps?.();
			this.#unsubscribeProps = null;
			this.#unsubscribeText?.();
			this.#unsubscribeText = null;
			this.#textNode = null;
			if (this.#mountedChildren !== null) {
				for (const child of this.#mountedChildren) child.unmount();
				this.#mountedChildren = null;
			}
		} finally {
			endDetach();
			endDiscard();
		}
		this.#props.this?.set(null);
		if (!detached) this.#element?.remove();
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

/** Sweep the server-injected head tags — the client `Head` recreates its own. */
function sweepHead() {
	for (const el of Array.from(dom.head().querySelectorAll("[data-ssr]"))) el.remove();
}

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
						// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SSR wrapper is verified via querySelector before hydration.
						hydrated = mountAll(children, ssr as HTMLElement);
					} catch (error) {
						endHydration();
						throw error;
					}
					const mismatch = endHydration();
					if (!mismatch) {
						// adopted: the wrapper stays as the mount root; drop the
						// attribute so a second render cannot re-claim it
						ssr.removeAttribute("data-ssr");
						sweepHead();
						adopted = ssr;
						instances = hydrated;
					} else {
						// the offending nodes ride along as arguments so the console
						// entry is inspectable, not just readable
						console.warn(describeMismatch(mismatch), {
							parent: mismatch.parent,
							found: mismatch.node,
						});
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
