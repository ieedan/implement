import {
	Binding,
	isReadable,
	isWritable,
	subscribe,
	type Readable,
	type ReadableSource,
	type Ref,
} from "../signal";
import { isDiscarding } from "../tree";
import type { Unsubscribe } from "../types";
import type { Child } from "./types";

/**
 * Structural stand-in for `Readable<T>`. Matching on shape lets any readable
 * of a T-subset fit (e.g. `Readable<string>` on a `string | number` prop),
 * which `Readable<T>` itself rejects because of its `bind` overloads.
 */
export type BindableReadable<T> = ReadableSource<T>;

/**
 * A static value or a readable. The prop updates when the readable changes
 * (signal → DOM). A readable may yield `undefined` to leave the prop unset —
 * the same as omitting it.
 */
export type OneWayBindable<T> = T | BindableReadable<T | undefined>;

/**
 * A readable that is also writable. Use this in your own component props when
 * write-back is required. Element props that can write back use
 * {@link MaybeTwoWayBindable} instead, where `set` is optional.
 */
export type TwoWayBindable<T> = BindableReadable<T> & {
	set(value: T): void;
};

/**
 * A {@link OneWayBindable} whose readable may also be writable. `set` is
 * optional: two-way props (`value`, `checked`, `open`) write the DOM back
 * when it is present, and stay one-way when it is not.
 */
export type MaybeTwoWayBindable<T> =
	| T
	| (BindableReadable<T | undefined> & {
			set?(value: T): void;
	  });

/**
 * A static value or a signal. Every element prop accepts this. A readable may
 * yield `undefined` to leave the prop unset — the same as omitting it.
 *
 * Two-way props (`value`, `checked`, `open`) are {@link MaybeTwoWayBindable}:
 * the same shape, with `set` optional so hover shows write-back without
 * requiring it. Force write-back in your own APIs with {@link TwoWayBindable}.
 */
export type Bindable<T> = OneWayBindable<T>;

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
	hidden?: Bindable<boolean | "until-found" | "hidden" | "">;
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
	role?: Bindable<AriaRole>;
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

/**
 * Browsing context name. Keywords get autocomplete; any string is allowed for
 * named frames (`target="foo"`).
 */
export type AnchorTarget = "_self" | "_blank" | "_parent" | "_top" | (string & {});

export type ReferrerPolicy =
	| ""
	| "no-referrer"
	| "no-referrer-when-downgrade"
	| "origin"
	| "origin-when-cross-origin"
	| "same-origin"
	| "strict-origin"
	| "strict-origin-when-cross-origin"
	| "unsafe-url";

export type CrossOrigin = "" | "anonymous" | "use-credentials";

export type FormMethod = "get" | "post" | "dialog";

export type FormEnctype =
	| "application/x-www-form-urlencoded"
	| "multipart/form-data"
	| "text/plain";

export type LinkAs =
	| "audio"
	| "document"
	| "embed"
	| "fetch"
	| "font"
	| "image"
	| "object"
	| "script"
	| "style"
	| "track"
	| "video"
	| "worker";

/** Single tokens autocomplete; space-separated lists are still valid. */
export type RelType =
	| "alternate"
	| "author"
	| "bookmark"
	| "canonical"
	| "dns-prefetch"
	| "external"
	| "help"
	| "icon"
	| "license"
	| "manifest"
	| "modulepreload"
	| "next"
	| "nofollow"
	| "noopener"
	| "noreferrer"
	| "opener"
	| "pingback"
	| "preconnect"
	| "prefetch"
	| "preload"
	| "prev"
	| "privacy-policy"
	| "search"
	| "stylesheet"
	| "tag"
	| "terms-of-service"
	| (string & {});

export type AutoComplete = "on" | "off" | (string & {});

export type HttpEquiv =
	| "content-security-policy"
	| "content-type"
	| "default-style"
	| "refresh"
	| "x-ua-compatible"
	| (string & {});

export type MetaName =
	| "application-name"
	| "author"
	| "color-scheme"
	| "description"
	| "generator"
	| "keywords"
	| "referrer"
	| "robots"
	| "theme-color"
	| "viewport"
	| (string & {});

/** Single tokens autocomplete; space-separated lists are still valid. */
export type Sandbox =
	| "allow-downloads"
	| "allow-forms"
	| "allow-modals"
	| "allow-orientation-lock"
	| "allow-pointer-lock"
	| "allow-popups"
	| "allow-popups-to-escape-sandbox"
	| "allow-presentation"
	| "allow-same-origin"
	| "allow-scripts"
	| "allow-storage-access-by-user-activation"
	| "allow-top-navigation"
	| "allow-top-navigation-by-user-activation"
	| "allow-top-navigation-to-custom-protocols"
	| (string & {});

export type AriaRole =
	| "alert"
	| "alertdialog"
	| "application"
	| "article"
	| "banner"
	| "blockquote"
	| "button"
	| "caption"
	| "cell"
	| "checkbox"
	| "code"
	| "columnheader"
	| "combobox"
	| "comment"
	| "complementary"
	| "contentinfo"
	| "definition"
	| "deletion"
	| "dialog"
	| "directory"
	| "document"
	| "emphasis"
	| "feed"
	| "figure"
	| "form"
	| "generic"
	| "grid"
	| "gridcell"
	| "group"
	| "heading"
	| "img"
	| "image"
	| "insertion"
	| "link"
	| "list"
	| "listbox"
	| "listitem"
	| "log"
	| "main"
	| "mark"
	| "marquee"
	| "math"
	| "menu"
	| "menubar"
	| "menuitem"
	| "menuitemcheckbox"
	| "menuitemradio"
	| "meter"
	| "navigation"
	| "none"
	| "note"
	| "option"
	| "paragraph"
	| "presentation"
	| "progressbar"
	| "radio"
	| "radiogroup"
	| "region"
	| "row"
	| "rowgroup"
	| "rowheader"
	| "scrollbar"
	| "search"
	| "searchbox"
	| "separator"
	| "slider"
	| "spinbutton"
	| "status"
	| "strong"
	| "subscript"
	| "suggestion"
	| "superscript"
	| "switch"
	| "tab"
	| "table"
	| "tablist"
	| "tabpanel"
	| "term"
	| "textbox"
	| "time"
	| "timer"
	| "toolbar"
	| "tooltip"
	| "tree"
	| "treegrid"
	| "treeitem";

type PreserveAspectRatioAlign =
	| "xMinYMin"
	| "xMidYMin"
	| "xMaxYMin"
	| "xMinYMid"
	| "xMidYMid"
	| "xMaxYMid"
	| "xMinYMax"
	| "xMidYMax"
	| "xMaxYMax";

export type PreserveAspectRatio =
	| "none"
	| PreserveAspectRatioAlign
	| `${PreserveAspectRatioAlign} ${"meet" | "slice"}`;

type TagAttributeMap = {
	a: {
		download?: Bindable<string | boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		ping?: Bindable<string>;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		rel?: Bindable<RelType>;
		target?: Bindable<AnchorTarget>;
		type?: Bindable<string>;
	};
	area: {
		alt?: Bindable<string>;
		coords?: Bindable<string>;
		download?: Bindable<string | boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		ping?: Bindable<string>;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		rel?: Bindable<RelType>;
		shape?: Bindable<"rect" | "circle" | "poly" | "default">;
		target?: Bindable<AnchorTarget>;
	};
	audio: MediaAttributes;
	base: {
		href?: Bindable<string>;
		target?: Bindable<AnchorTarget>;
	};
	blockquote: {
		cite?: Bindable<string>;
	};
	button: {
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		formAction?: Bindable<string>;
		formEnctype?: Bindable<FormEnctype>;
		formMethod?: Bindable<FormMethod>;
		formNoValidate?: Bindable<boolean>;
		formTarget?: Bindable<AnchorTarget>;
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
		open?: MaybeTwoWayBindable<boolean>;
	};
	dialog: {
		open?: MaybeTwoWayBindable<boolean>;
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
		autocomplete?: Bindable<"on" | "off">;
		enctype?: Bindable<FormEnctype>;
		method?: Bindable<FormMethod>;
		name?: Bindable<string>;
		noValidate?: Bindable<boolean>;
		rel?: Bindable<RelType>;
		target?: Bindable<AnchorTarget>;
	};
	iframe: {
		allow?: Bindable<string>;
		allowFullscreen?: Bindable<boolean>;
		height?: Bindable<number | string>;
		loading?: Bindable<"eager" | "lazy">;
		name?: Bindable<string>;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		sandbox?: Bindable<Sandbox>;
		src?: Bindable<string>;
		srcdoc?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	img: {
		alt?: Bindable<string>;
		crossOrigin?: Bindable<CrossOrigin>;
		decoding?: Bindable<"sync" | "async" | "auto">;
		fetchPriority?: Bindable<"high" | "low" | "auto">;
		height?: Bindable<number | string>;
		isMap?: Bindable<boolean>;
		loading?: Bindable<"eager" | "lazy">;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		sizes?: Bindable<string>;
		src?: Bindable<string>;
		srcset?: Bindable<string>;
		useMap?: Bindable<string>;
		width?: Bindable<number | string>;
	};
	input: {
		accept?: Bindable<string>;
		alt?: Bindable<string>;
		autocomplete?: Bindable<AutoComplete>;
		capture?: Bindable<boolean | "user" | "environment">;
		checked?: MaybeTwoWayBindable<boolean>;
		dirname?: Bindable<string>;
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		formAction?: Bindable<string>;
		formEnctype?: Bindable<FormEnctype>;
		formMethod?: Bindable<FormMethod>;
		formNoValidate?: Bindable<boolean>;
		formTarget?: Bindable<AnchorTarget>;
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
		value?: MaybeTwoWayBindable<string | number>;
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
		as?: Bindable<LinkAs>;
		crossOrigin?: Bindable<CrossOrigin>;
		disabled?: Bindable<boolean>;
		href?: Bindable<string>;
		hreflang?: Bindable<string>;
		integrity?: Bindable<string>;
		media?: Bindable<string>;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		rel?: Bindable<RelType>;
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
	meta: {
		charset?: Bindable<string>;
		content?: Bindable<string>;
		httpEquiv?: Bindable<HttpEquiv>;
		media?: Bindable<string>;
		name?: Bindable<MetaName>;
		/** RDFa name (`og:title`, `og:image`, …), written as the `property` attribute. */
		property?: Bindable<string>;
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
		crossOrigin?: Bindable<CrossOrigin>;
		defer?: Bindable<boolean>;
		integrity?: Bindable<string>;
		noModule?: Bindable<boolean>;
		referrerPolicy?: Bindable<ReferrerPolicy>;
		src?: Bindable<string>;
		type?: Bindable<string>;
	};
	select: {
		autocomplete?: Bindable<AutoComplete>;
		disabled?: Bindable<boolean>;
		form?: Bindable<string>;
		multiple?: Bindable<boolean>;
		name?: Bindable<string>;
		required?: Bindable<boolean>;
		size?: Bindable<number>;
		value?: MaybeTwoWayBindable<string>;
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
		autocomplete?: Bindable<AutoComplete>;
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
		value?: MaybeTwoWayBindable<string>;
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
	crossOrigin?: Bindable<CrossOrigin>;
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

/**
 * Props accepted by a component. Pass the component itself, or an HTML tag:
 *
 * ```ts
 * type DivProps = ComponentProps<typeof Div>;
 * type InputProps = ComponentProps<typeof Input>;
 * type DivPropsToo = ComponentProps<"div">;
 * ```
 *
 * Works for any function whose first argument is a props object, including
 * user components (`function Card(props: CardProps, ...children)`) and
 * components created with `createComponent` from `@implementjs/primitives`.
 */
export type ComponentProps<T extends ((...args: any) => any) | keyof HTMLElementTagNameMap> =
	T extends keyof HTMLElementTagNameMap
		? ElementProps<T>
		: T extends { __componentProps?: infer P }
			? NonNullable<P>
			: T extends (...args: any) => any
				? Parameters<T>[0]
				: never;

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
		preserveAspectRatio?: Bindable<PreserveAspectRatio>;
		role?: Bindable<AriaRole>;
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

function resolveEventName(key: string): string | null {
	if (key.length < 3 || !key.startsWith("on")) return null;
	const third = key[2];
	if (third === undefined || third !== third.toUpperCase() || third === third.toLowerCase()) {
		return null;
	}
	return key.slice(2).toLowerCase();
}

/**
 * Prop names repeat across every element of every row, and the answer never
 * changes for a given name — so it is worked out once instead of lower-casing a
 * fresh string per element. Bounded by the number of distinct prop names an app
 * uses, which is small.
 */
const eventNames = new Map<string, string | null>();

function eventName(key: string): string | null {
	const cached = eventNames.get(key);
	// `null` is a cached answer; only `undefined` means "not looked up yet".
	if (cached !== undefined) return cached;
	const resolved = resolveEventName(key);
	eventNames.set(key, resolved);
	return resolved;
}

type TwoWay = { event: string; read: (el: HTMLElement) => unknown };

/* oxlint-disable typescript/no-unsafe-type-assertion -- Tag-specific DOM properties for two-way binding. */
// Shared descriptors: these used to be built fresh on every matching prop of
// every element, which is an object and a closure per bound input in a list.
const SELECT_VALUE: TwoWay = { event: "change", read: (el) => (el as HTMLSelectElement).value };
const INPUT_VALUE: TwoWay = { event: "input", read: (el) => (el as HTMLInputElement).value };
const INPUT_CHECKED: TwoWay = { event: "change", read: (el) => (el as HTMLInputElement).checked };
const TOGGLE_OPEN: TwoWay = { event: "toggle", read: (el) => (el as HTMLDetailsElement).open };
/* oxlint-enable typescript/no-unsafe-type-assertion */

function twoWayBinding(tag: string, key: string): TwoWay | null {
	if (key === "value") {
		if (tag === "select") return SELECT_VALUE;
		if (tag === "input" || tag === "textarea") return INPUT_VALUE;
		return null;
	}
	if (key === "checked" && tag === "input") return INPUT_CHECKED;
	if (key === "open" && (tag === "details" || tag === "dialog")) return TOGGLE_OPEN;
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
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- camelCase style properties are indexed on CSSStyleDeclaration.
	(el.style as unknown as Record<string, string>)[property] = value;
}

function setDomValue(el: HTMLElement, key: string, value: unknown) {
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Generic DOM prop writes keyed by string names. */
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
	if (key === "hidden") {
		setAttribute(el, key, value, false);
		return;
	}
	if (key === "tabIndex" || key === "tabindex") {
		// always the attribute: the tabIndex property defaults to -1 on
		// non-focusable elements, so a property write of -1 would be skipped
		// as unchanged and the element would never become focusable
		setAttribute(el, "tabindex", value, false);
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
			(el as unknown as Record<string, unknown>)[prop] = value;
		}
		return;
	}

	setAttribute(el, key, value, false);
	/* oxlint-enable typescript/no-unsafe-type-assertion */
}

function noop() {}

/**
 * What a prop hands back to be undone: a plain unsubscribe, or a binding that
 * cancels itself. Keeping the union internal means a bound prop costs one
 * object and no closure, while the exported surface stays a function.
 */
export type Teardown = Unsubscribe | Binding<unknown>;

export function runTeardown(teardown: Teardown): void {
	if (typeof teardown === "function") teardown();
	else teardown.stop();
}

function bindEvent(el: Element, event: string, value: unknown): Unsubscribe {
	const attach = (handler: unknown): Unsubscribe => {
		if (typeof handler !== "function") return noop;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Event props accept any listener after a function check.
		const listener = handler as EventListener;
		el.addEventListener(event, listener);
		return () => {
			// A listener on a node being discarded dies with it. This runs once per
			// handler per element, which is tens of thousands of calls to tear down
			// a list, and every one of them is on a node nothing can reach again.
			if (!isDiscarding()) el.removeEventListener(event, listener);
		};
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

const callUnsubscribe = (unsubscribe: Unsubscribe): void => unsubscribe();

/**
 * A `class` that is one readable of plain strings — a `derived` or a `bind`,
 * the shape most reactive classes take. It writes the attribute straight from
 * the value, skipping the resolve pass, the nested-signal bookkeeping, and the
 * closures the general path needs. A value that turns out to hold nested
 * readables falls back to that path and stays there.
 */
class ClassBinding extends Binding<unknown> {
	private fallback: Unsubscribe | null = null;

	constructor(
		private readonly el: Element,
		private readonly source: ReadableSource,
	) {
		super();
		this.start(source);
	}

	protected apply(value: unknown): void {
		if (this.fallback !== null) return;
		if (typeof value === "string") {
			this.el.setAttribute("class", value);
			return;
		}
		if (value == null || typeof value === "boolean") {
			this.el.setAttribute("class", "");
			return;
		}
		// Arrays and objects can carry readables of their own, which need the
		// resolve-and-resubscribe machinery. Hand the whole prop over once.
		this.stop();
		this.fallback = bindClassValue(this.el, this.source);
	}

	override stop(): void {
		super.stop();
		this.fallback?.();
		this.fallback = null;
	}
}

function bindClassProp(el: Element, value: unknown): Teardown {
	// By far the most common class value is a literal string, and it needs no
	// resolution pass, no subscription bookkeeping, and no teardown.
	if (typeof value === "string") {
		el.setAttribute("class", value);
		return noop;
	}

	if (isReadable(value)) return new ClassBinding(el, value);

	return bindClassValue(el, value);
}

function bindClassValue(el: Element, value: unknown): Unsubscribe {
	let subscriptions: Map<Readable<unknown>, Unsubscribe> | null = null;
	const apply = () => {
		const found = new Set<Readable<unknown>>();
		const parts: string[] = [];
		resolveClassValue(value, found, parts);
		// resubscribe only what changed: signals nested inside a readable's value
		// can come and go, while stable ones must keep their subscription so a
		// notifying signal is never re-added to its own in-flight notify loop
		if (subscriptions !== null) {
			for (const [readable, unsubscribe] of subscriptions) {
				if (!found.has(readable)) {
					unsubscribe();
					subscriptions.delete(readable);
				}
			}
		}
		for (const readable of found) {
			subscriptions ??= new Map();
			if (!subscriptions.has(readable)) {
				subscriptions.set(readable, readable.subscribe(apply));
			}
		}
		// attribute write so SVG roots work too (their `className` is readonly)
		el.setAttribute("class", parts.join(" "));
	};
	apply();
	if (subscriptions === null) return noop;
	return () => {
		if (subscriptions === null) return;
		// forEach with a hoisted callback: iterating `.values()` would allocate an
		// iterator on a path that runs once per element in a discarded tree.
		subscriptions.forEach(callUnsubscribe);
		subscriptions.clear();
	};
}

function bindStyleObject(
	el: HTMLElement | SVGElement,
	styles: Record<string, unknown>,
): Unsubscribe {
	let unsubscribers: Unsubscribe[] | null = null;
	for (const property in styles) {
		const value = styles[property];
		if (value === undefined) continue;
		const apply = (resolved: unknown) => {
			setStyleProperty(el, property, resolved == null ? "" : toAttrString(resolved));
		};
		if (isReadable(value)) {
			(unsubscribers ??= []).push(subscribe([value], apply));
		} else {
			apply(value);
		}
	}
	if (unsubscribers === null) return noop;
	const bound = unsubscribers;
	return () => {
		for (const unsub of bound) unsub();
	};
}

/** Writes one reactive value to one SVG attribute, with no closure per prop. */
class SvgAttrBinding extends Binding<unknown> {
	constructor(
		private readonly el: SVGElement,
		private readonly name: string,
		private readonly booleanAsString: boolean,
		source: ReadableSource,
	) {
		super();
		this.start(source);
	}

	protected apply(value: unknown): void {
		setAttribute(this.el, this.name, value, this.booleanAsString);
	}
}

/** Writes one reactive value to one DOM property, with no closure per prop. */
class DomPropBinding extends Binding<unknown> {
	constructor(
		private readonly el: HTMLElement,
		private readonly key: string,
		source: ReadableSource,
	) {
		super();
		this.start(source);
	}

	protected apply(value: unknown): void {
		setDomValue(this.el, this.key, value);
	}
}

function bindDomProp(el: HTMLElement, tag: string, key: string, value: unknown): Teardown {
	const event = eventName(key);
	if (event) return bindEvent(el, event, value);
	if (key === "innerHTML") return noop;

	if (key === "class" || key === "className") {
		return bindClassProp(el, value);
	}

	if (key === "style" && value !== null && typeof value === "object" && !isReadable(value)) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Style objects are plain records after an object check.
		return bindStyleObject(el, value as Record<string, unknown>);
	}

	const twoWay = twoWayBinding(tag, key);
	if (twoWay && isWritable(value)) {
		const apply = (resolved: unknown) => setDomValue(el, key, resolved);
		const unsub = subscribe([value], apply);
		const handler = () => {
			value.set(twoWay.read(el));
		};
		el.addEventListener(twoWay.event, handler);
		return () => {
			unsub();
			el.removeEventListener(twoWay.event, handler);
		};
	}

	if (isReadable(value)) {
		return new DomPropBinding(el, key, value);
	}

	setDomValue(el, key, value);
	return noop;
}

/** Apply typed props (and signal subscriptions) to a mounted element. */
export function applyElementProps(
	el: HTMLElement,
	tag: string,
	props: Record<string, unknown>,
): Teardown {
	// An element whose props are all static — most of them — leaves with no
	// array and no teardown closure to allocate, and nothing to walk on unmount.
	let first: Teardown | null = null;
	let rest: Teardown[] | null = null;
	for (const key in props) {
		if (key === "children" || key === "this") continue;
		const value = props[key];
		if (value === undefined) continue;
		const unsubscribe = bindDomProp(el, tag, key, value);
		if (unsubscribe === noop) continue;
		if (first === null) first = unsubscribe;
		else (rest ??= []).push(unsubscribe);
	}
	// Nothing reactive leaves with no teardown at all; one reactive prop — the
	// usual shape — leaves with its own, and neither allocates an array.
	if (first === null) return noop;
	if (rest === null) return first;
	const head = first;
	const tail = rest;
	return () => {
		runTeardown(head);
		for (const teardown of tail) runTeardown(teardown);
	};
}

const SVG_ATTR_ALIASES: Record<string, string> = {
	className: "class",
	tabIndex: "tabindex",
};

function bindSvgProp(el: SVGElement, key: string, value: unknown): Teardown {
	const event = eventName(key);
	if (event) return bindEvent(el, event, value);

	if (key === "class" || key === "className") {
		return bindClassProp(el, value);
	}

	if (key === "style" && value !== null && typeof value === "object" && !isReadable(value)) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Style objects are plain records after an object check.
		return bindStyleObject(el, value as Record<string, unknown>);
	}

	// setAttribute does not lowercase names outside the HTML namespace, so
	// camelCase SVG attributes (viewBox) pass through untouched.
	const name = SVG_ATTR_ALIASES[key] ?? key;
	const booleanAsString = key.startsWith("aria-") || key.startsWith("data-");
	if (isReadable(value)) {
		return new SvgAttrBinding(el, name, booleanAsString, value);
	}

	setAttribute(el, name, value, booleanAsString);
	return noop;
}

/**
 * Apply typed props (and signal subscriptions) to a mounted SVG root.
 * Attribute-only: SVG DOM properties are readonly (`SVGAnimatedLength` etc.),
 * so the HTML property path can never be reused here.
 */
export function applySvgProps(el: SVGElement, props: Record<string, unknown>): Teardown {
	let first: Teardown | null = null;
	let rest: Teardown[] | null = null;
	for (const key in props) {
		if (key === "this") continue;
		const value = props[key];
		if (value === undefined) continue;
		const unsubscribe = bindSvgProp(el, key, value);
		if (unsubscribe === noop) continue;
		if (first === null) first = unsubscribe;
		else (rest ??= []).push(unsubscribe);
	}
	// Nothing reactive leaves with no teardown at all; one reactive prop — the
	// usual shape — leaves with its own, and neither allocates an array.
	if (first === null) return noop;
	if (rest === null) return first;
	const head = first;
	const tail = rest;
	return () => {
		runTeardown(head);
		for (const teardown of tail) runTeardown(teardown);
	};
}

/** Re-apply `value` after children mount so `<select>` options exist first. */
export function syncValueProp(el: HTMLElement, props: Record<string, unknown>) {
	if (!("value" in props) || props.value === undefined) return;
	const value = props.value;
	setDomValue(el, "value", isReadable(value) ? value.get() : value);
}
