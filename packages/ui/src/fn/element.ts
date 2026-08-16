/**
 * Closure-based element builders replacing the `Component` class hierarchy.
 *
 * `el(tag)` returns a plain object whose state lives in the closure. Nothing
 * touches the DOM or subscribes to signals until `mount`; `unmount` discards
 * the element and every subscription, and a later remount rebuilds from the
 * recorded ops — so builders describe, mounts realize.
 *
 * Because `ElementBuilder` is an interface with method syntax (bivariant
 * parameters), `ElementBuilder<"button">` is assignable to
 * `ElementBuilder<keyof HTMLElementTagNameMap>` — the "no any-component type"
 * papercut (PAPERCUTS.md #5) does not exist here.
 */

import { isWritable, type Writable } from "../signal";
import type { Unsubscribe } from "../types";
import {
	mountRegion,
	unmountRegion,
	watchProp,
	type ActiveRegion,
	type Child,
	type PropInput,
	type View,
} from "./view";

export type HTMLTag = keyof HTMLElementTagNameMap;
type ElementOf<T extends HTMLTag> = HTMLElementTagNameMap[T];

/** Event with `target` / `currentTarget` narrowed to the builder's element. */
type TypedEvent<E extends keyof HTMLElementEventMap, El extends HTMLElement> = Omit<
	HTMLElementEventMap[E],
	"target" | "currentTarget"
> & {
	readonly target: El;
	readonly currentTarget: El;
};

type StyleProperty = {
	[K in keyof CSSStyleDeclaration]: CSSStyleDeclaration[K] extends string
		? K extends string
			? K
			: never
		: never;
}[keyof CSSStyleDeclaration];

export type Styles = { [K in StyleProperty]?: PropInput<string> } & {
	[custom: `--${string}`]: PropInput<string> | undefined;
};

export interface ElementBuilder<T extends HTMLTag> extends View {
	id(value: PropInput<string>): this;
	className(value: PropInput<string>): this;
	/** Reactive text content. Owns the element's text; prefer `text()` children when mixing with elements. */
	content(value: PropInput<string>): this;
	/** Any attribute: `false`/`null` removes, `true` sets empty. Covers `href`, `disabled`, `aria-*`, … (MISSING.md #1). */
	attr(name: string, value: PropInput<string | boolean | null>): this;
	style(styles: Styles): this;
	on<E extends keyof HTMLElementEventMap>(
		event: E,
		handler: (ev: TypedEvent<E, ElementOf<T>>) => void,
	): this;
	ref(set: (el: ElementOf<T> | null) => void): this;
	/** Runs after the element is inserted and its children are mounted. */
	onMount(callback: (el: ElementOf<T>) => void): this;
	/** Runs before the element is removed, while it is still in the DOM. */
	onCleanup(callback: (el: ElementOf<T>) => void): this;
	/**
	 * The userland extension point: bind any `PropInput` to any application of
	 * it. Built-in props are written with this too, so wrapper components are
	 * first-class (PAPERCUTS.md #11).
	 */
	bind<V>(input: PropInput<V>, apply: (el: ElementOf<T>, value: V) => void): this;
	readonly element: ElementOf<T> | null;
}

export function el<T extends HTMLTag>(tag: T, ...children: Child[]): ElementBuilder<T> {
	let element: ElementOf<T> | null = null;
	let region: ActiveRegion | null = null;
	const unsubscribers: Unsubscribe[] = [];
	// deferred until mount: each op receives the freshly created element
	const mountOps: Array<(el: ElementOf<T>) => void> = [];
	const handlers: Array<{ event: string; handler: EventListener }> = [];
	const mountCallbacks: Array<(el: ElementOf<T>) => void> = [];
	const cleanupCallbacks: Array<(el: ElementOf<T>) => void> = [];
	let boundRef: ((el: ElementOf<T> | null) => void) | null = null;

	const self: ElementBuilder<T> = {
		get element() {
			return element;
		},

		bind(input, apply) {
			mountOps.push((el) => {
				unsubscribers.push(watchProp(input, (value) => apply(el, value)));
			});
			return this;
		},

		id(value) {
			return this.bind(value, (el, id) => {
				el.id = id;
			});
		},

		className(value) {
			return this.bind(value, (el, name) => {
				el.className = name;
			});
		},

		content(value) {
			return this.bind(value, (el, text) => {
				el.textContent = text;
			});
		},

		attr(name, value) {
			return this.bind(value, (el, resolved) => {
				if (resolved === false || resolved === null) {
					el.removeAttribute(name);
				} else {
					el.setAttribute(name, resolved === true ? "" : resolved);
				}
			});
		},

		style(styles) {
			for (const [property, value] of Object.entries(styles)) {
				if (value === undefined) continue;
				this.bind(value, (el, resolved) => {
					if (property.includes("-")) {
						el.style.setProperty(property, resolved);
					} else {
						(el.style as unknown as Record<string, string>)[property] = resolved;
					}
				});
			}
			return this;
		},

		on(event, handler) {
			handlers.push({ event, handler: handler as EventListener });
			return this;
		},

		ref(set) {
			boundRef = set;
			return this;
		},

		onMount(callback) {
			mountCallbacks.push(callback);
			return this;
		},

		onCleanup(callback) {
			cleanupCallbacks.push(callback);
			return this;
		},

		mount(parent, before = null) {
			if (element) return;
			const host = (element = document.createElement(tag));

			for (const op of mountOps) op(host);
			for (const { event, handler } of handlers) host.addEventListener(event, handler);

			parent.insertBefore(host, before);

			// children realize here — thunks run at mount, not at tree build
			region = mountRegion(children, host, null);

			boundRef?.(host);
			for (const callback of mountCallbacks) callback(host);
		},

		unmount() {
			const host = element;
			if (!host) return;

			for (const callback of cleanupCallbacks) callback(host);

			if (region) {
				unmountRegion(region);
				region = null;
			}

			for (const unsubscribe of unsubscribers) unsubscribe();
			unsubscribers.length = 0;

			host.remove();
			element = null;
			boundRef?.(null);
		},
	};

	return self;
}

/** A reactive text node — composes with element children (MISSING.md #15, "Text nodes"). */
export function text(value: PropInput<string>): View {
	let node: Text | null = null;
	let unsubscribe: Unsubscribe | null = null;
	return {
		mount(parent, before = null) {
			if (node) return;
			const textNode = (node = document.createTextNode(""));
			unsubscribe = watchProp(value, (resolved) => {
				textNode.data = resolved;
			});
			parent.insertBefore(textNode, before);
		},
		unmount() {
			unsubscribe?.();
			unsubscribe = null;
			node?.remove();
			node = null;
		},
	};
}

/**
 * Two-way input helper built by *wrapping* `el("input")` — composition where
 * the class model needed a `_input extends Component<"input">` subclass with
 * re-implemented overloads.
 */
export interface InputBuilder extends ElementBuilder<"input"> {
	type(value: PropInput<string>): this;
	placeholder(value: PropInput<string>): this;
	value(value: Writable<string> | PropInput<string>): this;
	checked(value: Writable<boolean> | PropInput<boolean>): this;
}

export function Input(...children: Child[]): InputBuilder {
	const base = el("input", ...children);

	const self: InputBuilder = Object.assign(base, {
		type(value: PropInput<string>) {
			base.bind(value, (el, type) => {
				el.type = type;
			});
			return self;
		},
		placeholder(value: PropInput<string>) {
			base.bind(value, (el, placeholder) => {
				el.placeholder = placeholder;
			});
			return self;
		},
		value(value: Writable<string> | PropInput<string>) {
			if (isWritable<string>(value)) {
				base.on("input", (ev) => value.set(ev.currentTarget.value));
			}
			base.bind(value as PropInput<string>, (el, resolved) => {
				if (el.value !== resolved) el.value = resolved;
			});
			return self;
		},
		checked(value: Writable<boolean> | PropInput<boolean>) {
			if (isWritable<boolean>(value)) {
				base.on("change", (ev) => value.set(ev.currentTarget.checked));
			}
			base.bind(value as PropInput<boolean>, (el, resolved) => {
				if (el.checked !== resolved) el.checked = resolved;
			});
			return self;
		},
	});

	return self;
}

// The generated per-tag file (packages/ui/src/components/index.ts, ~1100
// lines of `_div extends Component<"div">` pairs) collapses to a one-liner
// per tag. A representative set:

function tagFactory<T extends HTMLTag>(tag: T) {
	return (...children: Child[]): ElementBuilder<T> => el(tag, ...children);
}

export const A = tagFactory("a");
export const Button = tagFactory("button");
export const Div = tagFactory("div");
export const Form = tagFactory("form");
export const H1 = tagFactory("h1");
export const H2 = tagFactory("h2");
export const H3 = tagFactory("h3");
export const Header = tagFactory("header");
export const Img = tagFactory("img");
export const Label = tagFactory("label");
export const Li = tagFactory("li");
export const Main = tagFactory("main");
export const Nav = tagFactory("nav");
export const P = tagFactory("p");
export const Section = tagFactory("section");
export const Span = tagFactory("span");
export const Ul = tagFactory("ul");
