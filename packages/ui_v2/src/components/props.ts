import { isReadable, isWritable, subscribe, type Readable, type Ref } from "../signal";
import type { Unsubscribe } from "../types";
import type { Child } from "./types";

/**
 * A static value or a signal. Every element prop accepts this. The union both
 * distributes (so `Readable<string>` fits a `string | number` prop) and keeps
 * the undistributed readable (so `Readable<boolean>` fits a `boolean` prop).
 */
export type Bindable<T> = T | Readable<T> | (T extends unknown ? Readable<T> : never);

type ClassPrimitive = string | number | bigint | boolean | null | undefined;

/** Conditionally applied classes: each key is included while its value is truthy. */
export type ClassDictionary = Record<string, Bindable<ClassPrimitive>>;

export type ClassArray = ClassValue[];

/**
 * Structural stand-in for `Readable<ClassValue>`. Matching on shape lets any
 * readable of any class-value subset fit (e.g. `Readable<string | undefined>`),
 * which `Readable<ClassValue>` itself rejects because of its `bind` overloads.
 */
export interface ClassReadable {
	get(): ClassValue;
	subscribe(callback: (value: any) => void): Unsubscribe;
}

/**
 * A clsx-style `class` value: strings, `{ class: condition }` objects, and
 * arrays of either, nested arbitrarily. Falsy entries are skipped, so
 * `cond && "active"` works inline. A `Readable` fits anywhere a value does and
 * the class list re-resolves when it changes.
 *
 * @example
 * Div({ class: ["btn", { active: isActive }, large && "btn-lg"] })
 */
export type ClassValue = ClassPrimitive | ClassDictionary | ClassArray | ClassReadable;

type StyleProperty = {
	[K in keyof CSSStyleDeclaration]: CSSStyleDeclaration[K] extends string
		? K extends string
			? K
			: never
		: never;
}[keyof CSSStyleDeclaration];

/** Inline styles keyed by camelCase CSS property (or a `--custom` property). */
export type Styles = { [K in StyleProperty]?: Bindable<string> } & {
	[custom: `--${string}`]: Bindable<string> | undefined;
};

type TypedEvent<E extends keyof HTMLElementEventMap, El extends HTMLElement> = Omit<
	HTMLElementEventMap[E],
	"target" | "currentTarget"
> & {
	readonly target: El;
	readonly currentTarget: El;
};

type EventHandlers<El extends HTMLElement> = {
	[K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: Bindable<
		(this: El, ev: TypedEvent<K, El>) => void
	>;
};

type AriaAttributes = {
	[K in `aria-${string}`]?: Bindable<string | number | boolean | undefined>;
};

type DataAttributes = {
	[K in `data-${string}`]?: Bindable<string | number | boolean | undefined>;
};

type GlobalAttributes = {
	accessKey?: Bindable<string>;
	autocapitalize?: Bindable<"off" | "none" | "on" | "sentences" | "words" | "characters">;
	autofocus?: Bindable<boolean>;
	class?: ClassValue;
	className?: ClassValue;
	contentEditable?: Bindable<boolean | "true" | "false" | "plaintext-only" | "inherit">;
	dir?: Bindable<"ltr" | "rtl" | "auto">;
	draggable?: Bindable<boolean>;
	enterKeyHint?: Bindable<"enter" | "done" | "go" | "next" | "previous" | "search" | "send">;
	hidden?: Bindable<boolean | "until-found" | "hidden">;
	id?: Bindable<string>;
	inert?: Bindable<boolean>;
	inputMode?: Bindable<
		"none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url"
	>;
	is?: Bindable<string>;
	itemid?: Bindable<string>;
	itemprop?: Bindable<string>;
	itemref?: Bindable<string>;
	itemscope?: Bindable<boolean>;
	itemtype?: Bindable<string>;
	lang?: Bindable<string>;
	nonce?: Bindable<string>;
	part?: Bindable<string>;
	popover?: Bindable<"" | "auto" | "manual" | "hint" | boolean>;
	role?: Bindable<string>;
	slot?: Bindable<string>;
	spellcheck?: Bindable<boolean>;
	style?: Bindable<string> | Styles;
	tabIndex?: Bindable<number>;
	textContent?: Bindable<string>;
	title?: Bindable<string>;
	translate?: Bindable<boolean | "yes" | "no">;
	virtualKeyboardPolicy?: Bindable<"auto" | "manual">;
	writingsuggestions?: Bindable<boolean>;
};

export type InputType =
	| "button"
	| "checkbox"
	| "color"
	| "date"
	| "datetime-local"
	| "email"
	| "file"
	| "hidden"
	| "image"
	| "month"
	| "number"
	| "password"
	| "radio"
	| "range"
	| "reset"
	| "search"
	| "submit"
	| "tel"
	| "text"
	| "time"
	| "url"
	| "week";

type TagAttributeMap = {
	a: {
		download?: Bindable<string | boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		ping?: Bindable<string>;
		referrerPolicy?: Bindable<string>;
		rel?: Bindable<string>;
		target?: Bindable<string>;
		type?: Bindable<string>;
	};
	area: {
		alt?: Bindable<string>;
		coords?: Bindable<string>;
		download?: Bindable<string | boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		ping?: Bindable<string>;
		referrerPolicy?: Bindable<string>;
		rel?: Bindable<string>;
		shape?: Bindable<"rect" | "circle" | "poly" | "default">;
		target?: Bindable<string>;
	};
	audio: MediaAttributes;
	base: {
		href?: Bindable<string>;
		target?: Bindable<string>;
	};
	blockquote: {
		cite?: Bindable<string>;
	};
	button: {
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		formAction?: Bindable<string>;
		formEnctype?: Bindable<string>;
		formMethod?: Bindable<string>;
		formNoValidate?: Bindable<boolean>;
		formTarget?: Bindable<string>;
		name?: Bindable<string>;
		popoverTarget?: Bindable<string>;
		popoverTargetAction?: Bindable<"hide" | "show" | "toggle">;
		type?: Bindable<"submit" | "reset" | "button">;
		value?: Bindable<string>;
	};
	canvas: {
		height?: Bindable<number | string>;
		width?: Bindable<number | string>;
	};
	col: {
		span?: Bindable<number>;
	};
	colgroup: {
		span?: Bindable<number>;
	};
	data: {
		value?: Bindable<string>;
	};
	del: {
		cite?: Bindable<string>;
		dateTime?: Bindable<string>;
	};
	details: {
		name?: Bindable<string>;
		open?: Bindable<boolean>;
	};
	dialog: {
		open?: Bindable<boolean>;
	};
	embed: {
		height?: Bindable<number | string>;
		src?: Bindable<string>;
		type?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	fieldset: {
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		name?: Bindable<string>;
	};
	form: {
		acceptCharset?: Bindable<string>;
		action?: Bindable<string>;
		autocomplete?: Bindable<string>;
		enctype?: Bindable<string>;
		method?: Bindable<string>;
		name?: Bindable<string>;
		noValidate?: Bindable<boolean>;
		rel?: Bindable<string>;
		target?: Bindable<string>;
	};
	iframe: {
		allow?: Bindable<string>;
		allowFullscreen?: Bindable<boolean>;
		height?: Bindable<number | string>;
		loading?: Bindable<"eager" | "lazy">;
		name?: Bindable<string>;
		referrerPolicy?: Bindable<string>;
		sandbox?: Bindable<string>;
		src?: Bindable<string>;
		srcdoc?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	img: {
		alt?: Bindable<string>;
		crossOrigin?: Bindable<string>;
		decoding?: Bindable<"sync" | "async" | "auto">;
		fetchPriority?: Bindable<"high" | "low" | "auto">;
		height?: Bindable<number | string>;
		isMap?: Bindable<boolean>;
		loading?: Bindable<"eager" | "lazy">;
		referrerPolicy?: Bindable<string>;
		sizes?: Bindable<string>;
		src?: Bindable<string>;
		srcset?: Bindable<string>;
		useMap?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	input: {
		accept?: Bindable<string>;
		alt?: Bindable<string>;
		autocomplete?: Bindable<string>;
		capture?: Bindable<string | boolean>;
		checked?: Bindable<boolean>;
		dirname?: Bindable<string>;
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		formAction?: Bindable<string>;
		formEnctype?: Bindable<string>;
		formMethod?: Bindable<string>;
		formNoValidate?: Bindable<boolean>;
		formTarget?: Bindable<string>;
		height?: Bindable<number | string>;
		list?: Bindable<string>;
		max?: Bindable<string | number>;
		maxLength?: Bindable<number>;
		min?: Bindable<string | number>;
		minLength?: Bindable<number>;
		multiple?: Bindable<boolean>;
		name?: Bindable<string>;
		pattern?: Bindable<string>;
		placeholder?: Bindable<string>;
		popoverTarget?: Bindable<string>;
		popoverTargetAction?: Bindable<"hide" | "show" | "toggle">;
		readOnly?: Bindable<boolean>;
		required?: Bindable<boolean>;
		size?: Bindable<number>;
		src?: Bindable<string>;
		step?: Bindable<string | number>;
		type?: Bindable<InputType>;
		value?: Bindable<string | number>;
		width?: Bindable<number | string>;
	};
	ins: {
		cite?: Bindable<string>;
		dateTime?: Bindable<string>;
	};
	label: {
		for?: Bindable<string>;
		htmlFor?: Bindable<string>;
		form?: Bindable<string>;
	};
	li: {
		value?: Bindable<number>;
	};
	link: {
		as?: Bindable<string>;
		crossOrigin?: Bindable<string>;
		disabled?: Bindable<boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		integrity?: Bindable<string>;
		media?: Bindable<string>;
		referrerPolicy?: Bindable<string>;
		rel?: Bindable<string>;
		sizes?: Bindable<string>;
		type?: Bindable<string>;
	};
	map: {
		name?: Bindable<string>;
	};
	meter: {
		high?: Bindable<number>;
		low?: Bindable<number>;
		max?: Bindable<number>;
		min?: Bindable<number>;
		optimum?: Bindable<number>;
		value?: Bindable<number>;
	};
	object: {
		data?: Bindable<string>;
		form?: Bindable<string>;
		height?: Bindable<number | string>;
		name?: Bindable<string>;
		type?: Bindable<string>;
		useMap?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	ol: {
		reversed?: Bindable<boolean>;
		start?: Bindable<number>;
		type?: Bindable<"1" | "a" | "A" | "i" | "I">;
	};
	optgroup: {
		disabled?: Bindable<boolean>;
		label?: Bindable<string>;
	};
	option: {
		disabled?: Bindable<boolean>;
		label?: Bindable<string>;
		selected?: Bindable<boolean>;
		value?: Bindable<string>;
	};
	output: {
		for?: Bindable<string>;
		htmlFor?: Bindable<string>;
		form?: Bindable<string>;
		name?: Bindable<string>;
	};
	progress: {
		max?: Bindable<number>;
		value?: Bindable<number>;
	};
	q: {
		cite?: Bindable<string>;
	};
	script: {
		async?: Bindable<boolean>;
		crossOrigin?: Bindable<string>;
		defer?: Bindable<boolean>;
		integrity?: Bindable<string>;
		noModule?: Bindable<boolean>;
		referrerPolicy?: Bindable<string>;
		src?: Bindable<string>;
		type?: Bindable<string>;
	};
	select: {
		autocomplete?: Bindable<string>;
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		multiple?: Bindable<boolean>;
		name?: Bindable<string>;
		required?: Bindable<boolean>;
		size?: Bindable<number>;
		value?: Bindable<string>;
	};
	slot: {
		name?: Bindable<string>;
	};
	source: {
		height?: Bindable<number | string>;
		media?: Bindable<string>;
		sizes?: Bindable<string>;
		src?: Bindable<string>;
		srcset?: Bindable<string>;
		type?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	style: {
		media?: Bindable<string>;
		type?: Bindable<string>;
	};
	td: {
		colSpan?: Bindable<number>;
		headers?: Bindable<string>;
		rowSpan?: Bindable<number>;
	};
	textarea: {
		autocomplete?: Bindable<string>;
		cols?: Bindable<number>;
		dirname?: Bindable<string>;
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		maxLength?: Bindable<number>;
		minLength?: Bindable<number>;
		name?: Bindable<string>;
		placeholder?: Bindable<string>;
		readOnly?: Bindable<boolean>;
		required?: Bindable<boolean>;
		rows?: Bindable<number>;
		value?: Bindable<string>;
		wrap?: Bindable<"hard" | "soft" | "off">;
	};
	th: {
		abbr?: Bindable<string>;
		colSpan?: Bindable<number>;
		headers?: Bindable<string>;
		rowSpan?: Bindable<number>;
		scope?: Bindable<"row" | "col" | "rowgroup" | "colgroup">;
	};
	time: {
		dateTime?: Bindable<string>;
	};
	track: {
		default?: Bindable<boolean>;
		kind?: Bindable<"subtitles" | "captions" | "descriptions" | "chapters" | "metadata">;
		label?: Bindable<string>;
		src?: Bindable<string>;
		srclang?: Bindable<string>;
	};
	video: MediaAttributes & {
		disablePictureInPicture?: Bindable<boolean>;
		height?: Bindable<number | string>;
		poster?: Bindable<string>;
		width?: Bindable<number | string>;
	};
};

type MediaAttributes = {
	autoplay?: Bindable<boolean>;
	controls?: Bindable<boolean>;
	crossOrigin?: Bindable<string>;
	currentTime?: Bindable<number>;
	loop?: Bindable<boolean>;
	muted?: Bindable<boolean>;
	playsInline?: Bindable<boolean>;
	preload?: Bindable<"none" | "metadata" | "auto" | "">;
	src?: Bindable<string>;
	volume?: Bindable<number>;
};

type TagSpecific<T extends keyof HTMLElementTagNameMap> = T extends keyof TagAttributeMap
	? TagAttributeMap[T]
	: {};

/** HTML void elements cannot have children. */
export type VoidHTMLElement =
	| "area"
	| "base"
	| "br"
	| "col"
	| "embed"
	| "hr"
	| "img"
	| "input"
	| "link"
	| "meta"
	| "source"
	| "track"
	| "wbr";

export type ElementChildArgs<T extends keyof HTMLElementTagNameMap> = T extends VoidHTMLElement
	? []
	: Child[];

/**
 * A `Ref` bound to a mounted element. `Ref<El>` is the usual value;
 * `Ref<HTMLElement>` is also accepted so a shared ref can bind any tag.
 */
export type ElementThis<El extends HTMLElement> = Ref<El> | Ref<HTMLElement>;

export type ElementProps<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
	GlobalAttributes &
		EventHandlers<HTMLElementTagNameMap[T]> &
		TagSpecific<T> &
		AriaAttributes &
		DataAttributes & {
			children?: T extends VoidHTMLElement ? never : Child | Child[];
			/**
			 * Bind the mounted element. Pass a `Ref`. Written after this node is
			 * appended to its parent; `null` on unmount. The node may not be
			 * connected yet (ancestors append after children).
			 */
			this?: ElementThis<HTMLElementTagNameMap[T]>;
		};

export type Props<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
	ElementProps<T>;

type SvgTypedEvent<E extends keyof SVGElementEventMap> = Omit<
	SVGElementEventMap[E],
	"target" | "currentTarget"
> & {
	readonly target: SVGSVGElement;
	readonly currentTarget: SVGSVGElement;
};

type SvgEventHandlers = {
	[K in keyof SVGElementEventMap as `on${Capitalize<K>}`]?: Bindable<
		(this: SVGSVGElement, ev: SvgTypedEvent<K>) => void
	>;
};

/**
 * Props for the root element of an `Svg` component. Keys are the literal SVG
 * attribute names (`viewBox`, `stroke-width`) since everything is written as an
 * attribute; content inside the root stays authored in the source string.
 */
export type SvgProps = SvgEventHandlers &
	AriaAttributes &
	DataAttributes & {
		class?: ClassValue;
		className?: ClassValue;
		fill?: Bindable<string>;
		height?: Bindable<number | string>;
		id?: Bindable<string>;
		opacity?: Bindable<number | string>;
		preserveAspectRatio?: Bindable<string>;
		role?: Bindable<string>;
		stroke?: Bindable<string>;
		"stroke-dasharray"?: Bindable<number | string>;
		"stroke-dashoffset"?: Bindable<number | string>;
		"stroke-linecap"?: Bindable<"butt" | "round" | "square">;
		"stroke-linejoin"?: Bindable<"miter" | "miter-clip" | "round" | "bevel" | "arcs">;
		"stroke-width"?: Bindable<number | string>;
		style?: Bindable<string> | Styles;
		tabIndex?: Bindable<number>;
		viewBox?: Bindable<string>;
		width?: Bindable<number | string>;
		/**
		 * Bind the mounted root element. Written after the root is inserted;
		 * `null` on unmount (and re-written when a reactive source swaps it).
		 */
		this?: Ref<SVGSVGElement> | Ref<SVGElement>;
	};

const ATTR_ALIASES: Record<string, string> = {
	class: "className",
	for: "htmlFor",
	readonly: "readOnly",
	tabindex: "tabIndex",
	colspan: "colSpan",
	rowspan: "rowSpan",
	contenteditable: "contentEditable",
	maxlength: "maxLength",
	minlength: "minLength",
	datetime: "dateTime",
	crossorigin: "crossOrigin",
	formaction: "formAction",
	formenctype: "formEnctype",
	formmethod: "formMethod",
	formnovalidate: "formNoValidate",
	formtarget: "formTarget",
	novalidate: "noValidate",
	srcset: "srcset",
	usemap: "useMap",
	playsinline: "playsInline",
	referrerpolicy: "referrerPolicy",
	fetchpriority: "fetchPriority",
	enterkeyhint: "enterKeyHint",
	inputmode: "inputMode",
	popovertarget: "popoverTarget",
	popovertargetaction: "popoverTargetAction",
	allowfullscreen: "allowFullscreen",
};

function eventName(key: string): string | null {
	if (key.length < 3 || !key.startsWith("on")) return null;
	const third = key[2];
	if (third === undefined || third !== third.toUpperCase() || third === third.toLowerCase()) {
		return null;
	}
	return key.slice(2).toLowerCase();
}

function twoWayBinding(
	tag: string,
	key: string,
): { event: string; read: (el: HTMLElement) => unknown } | null {
	if (key === "value") {
		if (tag === "select") {
			return { event: "change", read: (el) => (el as HTMLSelectElement).value };
		}
		if (tag === "input" || tag === "textarea") {
			return { event: "input", read: (el) => (el as HTMLInputElement).value };
		}
		return null;
	}
	if (key === "checked" && tag === "input") {
		return { event: "change", read: (el) => (el as HTMLInputElement).checked };
	}
	if (key === "open" && (tag === "details" || tag === "dialog")) {
		return { event: "toggle", read: (el) => (el as HTMLDetailsElement).open };
	}
	return null;
}

function toAttrString(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return `${value}`;
	}
	return "";
}

function setAttribute(el: Element, name: string, value: unknown, booleanAsString: boolean) {
	if (value == null) {
		el.removeAttribute(name);
		return;
	}
	if (typeof value === "boolean") {
		if (booleanAsString) {
			el.setAttribute(name, String(value));
			return;
		}
		if (value) {
			el.setAttribute(name, "");
		} else {
			el.removeAttribute(name);
		}
		return;
	}
	el.setAttribute(name, toAttrString(value));
}

function setStyleProperty(el: HTMLElement | SVGElement, property: string, value: string) {
	if (property.startsWith("--") || property.includes("-")) {
		el.style.setProperty(property, value);
		return;
	}
	(el.style as unknown as Record<string, string>)[property] = value;
}

function setDomValue(el: HTMLElement, key: string, value: unknown) {
	if (key === "style") {
		el.style.cssText = value == null ? "" : toAttrString(value);
		return;
	}
	if (key === "for" || key === "htmlFor") {
		(el as HTMLLabelElement).htmlFor = value == null ? "" : toAttrString(value);
		return;
	}
	if (key === "textContent") {
		el.textContent = value == null ? "" : toAttrString(value);
		return;
	}
	if (key.startsWith("aria-") || key.startsWith("data-")) {
		setAttribute(el, key, value, true);
		return;
	}
	if (key === "value") {
		const next = value == null ? "" : toAttrString(value);
		if ((el as HTMLInputElement).value !== next) {
			(el as HTMLInputElement).value = next;
		}
		return;
	}
	if (key === "checked") {
		const next = Boolean(value);
		if ((el as HTMLInputElement).checked !== next) {
			(el as HTMLInputElement).checked = next;
		}
		return;
	}

	const prop = ATTR_ALIASES[key] ?? key;
	if (prop in el) {
		const current = (el as unknown as Record<string, unknown>)[prop];
		if (typeof current === "boolean" || typeof value === "boolean") {
			(el as unknown as Record<string, unknown>)[prop] = Boolean(value);
			return;
		}
		if (value == null) {
			(el as unknown as Record<string, unknown>)[prop] = "";
			el.removeAttribute(key);
			return;
		}
		if (current !== value) {
			(el as unknown as Record<string, unknown>)[prop] = value as never;
		}
		return;
	}

	setAttribute(el, key, value, false);
}

function noop() {}

function bindEvent(el: Element, event: string, value: unknown): Unsubscribe {
	const attach = (handler: unknown): Unsubscribe => {
		if (typeof handler !== "function") return noop;
		const listener = handler as EventListener;
		el.addEventListener(event, listener);
		return () => el.removeEventListener(event, listener);
	};

	if (isReadable(value)) {
		let current: Unsubscribe = noop;
		const unsub = subscribe([value], (handler) => {
			current();
			current = attach(handler);
		});
		return () => {
			unsub();
			current();
		};
	}

	return attach(value);
}

function resolveClassValue(value: unknown, found: Set<Readable<unknown>>, out: string[]) {
	if (value == null || typeof value === "boolean" || value === "") return;
	if (typeof value === "string") {
		out.push(value);
		return;
	}
	if (typeof value === "number" || typeof value === "bigint") {
		out.push(`${value}`);
		return;
	}
	if (isReadable(value)) {
		found.add(value);
		resolveClassValue(value.get(), found, out);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			resolveClassValue(item, found, out);
		}
		return;
	}
	if (typeof value === "object") {
		for (const [name, condition] of Object.entries(value)) {
			let resolved = condition;
			if (isReadable(condition)) {
				found.add(condition);
				resolved = condition.get();
			}
			if (resolved) {
				out.push(name);
			}
		}
	}
}

function bindClassProp(el: Element, value: unknown): Unsubscribe {
	const subscriptions = new Map<Readable<unknown>, Unsubscribe>();
	const apply = () => {
		const found = new Set<Readable<unknown>>();
		const parts: string[] = [];
		resolveClassValue(value, found, parts);
		// resubscribe only what changed: signals nested inside a readable's value
		// can come and go, while stable ones must keep their subscription so a
		// notifying signal is never re-added to its own in-flight notify loop
		for (const [readable, unsubscribe] of subscriptions) {
			if (!found.has(readable)) {
				unsubscribe();
				subscriptions.delete(readable);
			}
		}
		for (const readable of found) {
			if (!subscriptions.has(readable)) {
				subscriptions.set(readable, readable.subscribe(apply));
			}
		}
		// attribute write so SVG roots work too (their `className` is readonly)
		el.setAttribute("class", parts.join(" "));
	};
	apply();
	return () => {
		for (const unsubscribe of subscriptions.values()) {
			unsubscribe();
		}
		subscriptions.clear();
	};
}

function bindStyleObject(el: HTMLElement | SVGElement, styles: Record<string, unknown>): Unsubscribe {
	const unsubscribers: Unsubscribe[] = [];
	for (const [property, value] of Object.entries(styles)) {
		if (value === undefined) continue;
		const apply = (resolved: unknown) => {
			setStyleProperty(el, property, resolved == null ? "" : toAttrString(resolved));
		};
		if (isReadable(value)) {
			unsubscribers.push(subscribe([value], apply));
		} else {
			apply(value);
		}
	}
	return () => {
		for (const unsub of unsubscribers) unsub();
	};
}

function bindDomProp(el: HTMLElement, tag: string, key: string, value: unknown): Unsubscribe {
	const event = eventName(key);
	if (event) return bindEvent(el, event, value);
	if (key === "innerHTML") return noop;

	if (key === "class" || key === "className") {
		return bindClassProp(el, value);
	}

	if (key === "style" && value !== null && typeof value === "object" && !isReadable(value)) {
		return bindStyleObject(el, value as Record<string, unknown>);
	}

	const twoWay = twoWayBinding(tag, key);
	const apply = (resolved: unknown) => setDomValue(el, key, resolved);

	if (twoWay && isWritable(value)) {
		const unsub = subscribe([value], apply);
		const handler = () => {
			value.set(twoWay.read(el) as never);
		};
		el.addEventListener(twoWay.event, handler);
		return () => {
			unsub();
			el.removeEventListener(twoWay.event, handler);
		};
	}

	if (isReadable(value)) {
		return subscribe([value], apply);
	}

	apply(value);
	return () => {};
}

/** Apply typed props (and signal subscriptions) to a mounted element. */
export function applyElementProps(
	el: HTMLElement,
	tag: string,
	props: Record<string, unknown>,
): Unsubscribe {
	const unsubscribers: Unsubscribe[] = [];
	for (const [key, value] of Object.entries(props)) {
		if (key === "children" || key === "this" || value === undefined) continue;
		unsubscribers.push(bindDomProp(el, tag, key, value));
	}
	return () => {
		for (const unsub of unsubscribers) unsub();
	};
}

const SVG_ATTR_ALIASES: Record<string, string> = {
	className: "class",
	tabIndex: "tabindex",
};

function bindSvgProp(el: SVGElement, key: string, value: unknown): Unsubscribe {
	const event = eventName(key);
	if (event) return bindEvent(el, event, value);

	if (key === "class" || key === "className") {
		return bindClassProp(el, value);
	}

	if (key === "style" && value !== null && typeof value === "object" && !isReadable(value)) {
		return bindStyleObject(el, value as Record<string, unknown>);
	}

	// setAttribute does not lowercase names outside the HTML namespace, so
	// camelCase SVG attributes (viewBox) pass through untouched.
	const name = SVG_ATTR_ALIASES[key] ?? key;
	const booleanAsString = key.startsWith("aria-") || key.startsWith("data-");
	const apply = (resolved: unknown) => setAttribute(el, name, resolved, booleanAsString);

	if (isReadable(value)) {
		return subscribe([value], apply);
	}

	apply(value);
	return noop;
}

/**
 * Apply typed props (and signal subscriptions) to a mounted SVG root.
 * Attribute-only: SVG DOM properties are readonly (`SVGAnimatedLength` etc.),
 * so the HTML property path can never be reused here.
 */
export function applySvgProps(el: SVGElement, props: Record<string, unknown>): Unsubscribe {
	const unsubscribers: Unsubscribe[] = [];
	for (const [key, value] of Object.entries(props)) {
		if (key === "this" || value === undefined) continue;
		unsubscribers.push(bindSvgProp(el, key, value));
	}
	return () => {
		for (const unsub of unsubscribers) unsub();
	};
}

/** Re-apply `value` after children mount so `<select>` options exist first. */
export function syncValueProp(el: HTMLElement, props: Record<string, unknown>) {
	if (!("value" in props) || props.value === undefined) return;
	const value = props.value;
	setDomValue(el, "value", isReadable(value) ? value.get() : value);
}
