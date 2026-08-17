import { isReadable, isWritable, subscribe, type Readable } from "../signal";
import type { Unsubscribe } from "../types";
import type { Child } from "./types";

/** A static value or a signal. Every element prop accepts this. */
export type Bindable<T> = T extends unknown ? T | Readable<T> : never;

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
	class?: Bindable<string | undefined | null>;
	className?: Bindable<string | undefined | null>;
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

export type ElementProps<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
	GlobalAttributes &
		EventHandlers<HTMLElementTagNameMap[T]> &
		TagSpecific<T> &
		AriaAttributes &
		DataAttributes & {
			children?: Child | Child[];
		};

export type Props<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> =
	ElementProps<T>;

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

function setAttribute(el: HTMLElement, name: string, value: unknown, booleanAsString: boolean) {
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

function setStyleProperty(el: HTMLElement, property: string, value: string) {
	if (property.startsWith("--") || property.includes("-")) {
		el.style.setProperty(property, value);
		return;
	}
	(el.style as unknown as Record<string, string>)[property] = value;
}

function setDomValue(el: HTMLElement, key: string, value: unknown) {
	if (key === "class" || key === "className") {
		el.className = value == null || value === false ? "" : toAttrString(value);
		return;
	}
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

function bindEvent(el: HTMLElement, event: string, value: unknown): Unsubscribe {
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

function bindStyleObject(el: HTMLElement, styles: Record<string, unknown>): Unsubscribe {
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
		if (key === "children" || value === undefined) continue;
		unsubscribers.push(bindDomProp(el, tag, key, value));
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
