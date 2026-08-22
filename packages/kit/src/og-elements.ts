/**
 * The core element factories, retyped with satori's `tw` prop.
 *
 * `tw` is not an html attribute, so it is not in core's `GlobalAttributes` and
 * `Div({ tw: "flex" })` does not typecheck against `@implementjs/core`. It
 * does not belong there either — it would type an attribute onto every element
 * of every app, and a real ssr render would serialize a stray `tw="…"` into
 * the document. So it lives here, where the only consumer that reads it is the
 * image renderer, and the import specifier says which kind of file you are in.
 *
 * Runtime is core's, unchanged: an unknown prop falls through `setDomValue` to
 * `setAttribute`, so `tw` lands in the element's attributes and the mapper in
 * `./og.ts` hands it to satori.
 */

import {
	element,
	type Child,
	type ComponentFactory,
	type ElementChildArgs,
	type ElementProps,
	type Styles,
} from "@implementjs/core";

/**
 * Styles as satori reads them, which is not quite what the dom does.
 *
 * A bare number is px — `{ fontSize: 64 }`, the way every `@vercel/og` example
 * is written. Core's `Styles` is strings only, and rightly so: a browser drops
 * `style.fontSize = "64"` on the floor. Satori has no such problem, because
 * `./og.ts` puts the unit back before it ever sees the value.
 *
 * Unknown properties are allowed through as well, since satori implements
 * a few (`lineClamp`) that `CSSStyleDeclaration` does not declare, and
 * declares none of the ones it ignores. The cost is that a typo is not caught
 * here — it shows up as a style that did nothing.
 */
export type OgStyles = { [K in keyof Styles]?: string | number } & {
	[property: string]: string | number | undefined;
};

/** An element's props, with satori's `style` and `tw` in place of the dom's. */
export type OgElementProps<T extends keyof HTMLElementTagNameMap> = Omit<
	ElementProps<T>,
	"style"
> & {
	style?: OgStyles;
	/**
	 * Tailwind utilities, resolved by satori itself against its own
	 * (Tailwind v3-shaped) config — *not* against the app's stylesheet. Pass
	 * `tailwindConfig` to `ImageResponse` to teach it a theme; a class naming a
	 * token it has never heard of resolves to nothing.
	 */
	tw?: string;
};

/**
 * `element()` from core with `tw` added to the props. The overloads mirror
 * core's exactly — props-first or children-first — so these are drop-in for
 * the factories in `@implementjs/core/elements`.
 */
export function ogElement<T extends keyof HTMLElementTagNameMap>(tag: T) {
	const factory = element(tag);
	function og(...children: ElementChildArgs<T>): ComponentFactory<T>;
	function og(props: OgElementProps<T>, ...children: ElementChildArgs<T>): ComponentFactory<T>;
	function og(propsOrChild?: OgElementProps<T> | Child, ...rest: Child[]): ComponentFactory<T> {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `tw` widens the props type only; the runtime call is core's, unchanged.
		const call = factory as (
			props?: OgElementProps<T> | Child,
			...rest: Child[]
		) => ComponentFactory<T>;
		return call(propsOrChild, ...rest);
	}
	return og;
}

/*
 * The elements satori lays out. Anything missing is one `ogElement("tag")`
 * away — the list is short because an image is not a document, and a tag
 * satori has no layout rules for renders as a plain block either way.
 */
export const B = /* @__PURE__ */ ogElement("b");
export const Br = /* @__PURE__ */ ogElement("br");
export const Code = /* @__PURE__ */ ogElement("code");
export const Div = /* @__PURE__ */ ogElement("div");
export const Em = /* @__PURE__ */ ogElement("em");
export const H1 = /* @__PURE__ */ ogElement("h1");
export const H2 = /* @__PURE__ */ ogElement("h2");
export const H3 = /* @__PURE__ */ ogElement("h3");
export const H4 = /* @__PURE__ */ ogElement("h4");
export const H5 = /* @__PURE__ */ ogElement("h5");
export const H6 = /* @__PURE__ */ ogElement("h6");
export const I = /* @__PURE__ */ ogElement("i");
export const Img = /* @__PURE__ */ ogElement("img");
export const Li = /* @__PURE__ */ ogElement("li");
export const Ol = /* @__PURE__ */ ogElement("ol");
export const P = /* @__PURE__ */ ogElement("p");
export const Pre = /* @__PURE__ */ ogElement("pre");
export const Span = /* @__PURE__ */ ogElement("span");
export const Strong = /* @__PURE__ */ ogElement("strong");
export const Ul = /* @__PURE__ */ ogElement("ul");
