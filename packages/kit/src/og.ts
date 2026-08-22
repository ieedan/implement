/**
 * Open Graph image generation: implement components in, a `Response` carrying
 * a png out.
 *
 * ```ts
 * // src/routes/blog/[slug]/.png/server.ts
 * import { Div, ImageResponse } from "@implementjs/kit/og";
 * import type { RequestEvent } from "./$types";
 *
 * export function GET({ params }: RequestEvent): Response {
 * 	return new ImageResponse(
 * 		Div({ style: { display: "flex", fontSize: 64 } }, params.slug),
 * 		{ width: 1200, height: 630 },
 * 	);
 * }
 * ```
 *
 * The api is `@vercel/og`'s, deliberately: same constructor, same options
 * object, same defaults, same `Response` semantics. What differs is the first
 * argument — core components rather than JSX, since implement has no JSX and
 * satori's real input is a `{ type, props }` tree either way. `renderToTree`
 * hands us that tree directly, so nothing is serialized to html and re-parsed.
 *
 * Nothing about the route is special: this is an ordinary `server.ts`
 * endpoint returning an ordinary `Response`, so a `.png` extension route
 * prerenders into a file next to the page it belongs to, and a route that
 * opts out of prerendering is rendered per request by whatever adapter is
 * deployed.
 *
 * ## What satori will and will not lay out
 *
 * Satori implements a flexbox subset, not css. Three consequences worth
 * knowing before the first render:
 *
 * - **`class` does nothing.** Satori never sees a stylesheet. Style with the
 *   `style` prop, or with `tw` (see `./og-elements.ts`), which satori resolves
 *   itself.
 * - **An element with more than one child needs an explicit
 *   `display: "flex"`.** Satori errors otherwise rather than guessing.
 * - **Numbers are px.** Core stringifies a style value before this module sees
 *   it, so `{ fontSize: 64 }` would arrive as the string `"64"` and mean
 *   nothing to satori. Bare numbers get `px` appended here for every property
 *   that is not unitless, which is the rule React uses and the reason vercel's
 *   examples read the way they do.
 */

import type { Child } from "@implementjs/core";
import { renderToTree, type RenderedNode } from "@implementjs/core/server";
import { ELEMENT_NODE, parse, TEXT_NODE, type Node } from "ultrahtml";

/** A font satori renders text with. `data` is the font file itself — ttf, otf, or woff (not woff2). */
export type OgFont = {
	name: string;
	data: ArrayBuffer | Uint8Array;
	weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	style?: "normal" | "italic";
	lang?: string;
};

/** Which emoji set to substitute for emoji graphemes, matching `@vercel/og`'s option. */
export type EmojiType = "twemoji" | "openmoji" | "blobmoji" | "noto" | "fluent" | "fluentFlat";

export type ImageResponseOptions = ResponseInit & {
	/** Image width in px. Defaults to 1200 — the Open Graph convention. */
	width?: number;
	/** Image height in px. Defaults to 630. */
	height?: number;
	/**
	 * Fonts to render text with. Satori has no system fonts and no fallback of
	 * its own, so leaving this out uses the Inter subset kit vendors, and
	 * anything outside latin renders as blank boxes until a font covering it is
	 * passed here.
	 */
	fonts?: OgFont[];
	/**
	 * Emoji set to fetch graphemes from. **Requires network at render time**,
	 * including during a build's prerender — leave it off to keep the build
	 * offline, and emoji fall back to whatever the fonts cover.
	 */
	emoji?: EmojiType;
	/** Satori's layout debug overlay. */
	debug?: boolean;
	/** `"png"` (default) or `"svg"` — no social platform accepts svg, so it is for debugging. */
	format?: "png" | "svg";
	/**
	 * A Tailwind v3-shaped config for the `tw` prop. Satori resolves `tw`
	 * against this and nothing else: the app's own stylesheet, and a Tailwind
	 * v4 `@theme`, are invisible to it.
	 */
	tailwindConfig?: Record<string, unknown>;
};

/** Style properties whose bare numbers are not px. Straight from React's list. */
const UNITLESS = new Set([
	"animationIterationCount",
	"aspectRatio",
	"borderImageOutset",
	"borderImageSlice",
	"borderImageWidth",
	"boxFlex",
	"boxFlexGroup",
	"boxOrdinalGroup",
	"columnCount",
	"columns",
	"flex",
	"flexGrow",
	"flexPositive",
	"flexShrink",
	"flexNegative",
	"flexOrder",
	"gridArea",
	"gridRow",
	"gridRowEnd",
	"gridRowSpan",
	"gridRowStart",
	"gridColumn",
	"gridColumnEnd",
	"gridColumnSpan",
	"gridColumnStart",
	"fontWeight",
	"lineClamp",
	"lineHeight",
	"opacity",
	"order",
	"orphans",
	"scale",
	"tabSize",
	"widows",
	"zIndex",
	"zoom",
	"fillOpacity",
	"floodOpacity",
	"stopOpacity",
	"strokeDasharray",
	"strokeDashoffset",
	"strokeMiterlimit",
	"strokeOpacity",
	"strokeWidth",
]);

const NUMERIC = /^-?\d*\.?\d+$/;

/**
 * A style value as satori should read it. Core has already stringified
 * whatever the style prop held, so a bare number arrives as digits and the
 * unit it was written without has to be put back.
 */
function styleValue(property: string, value: string): string {
	if (property.startsWith("--")) return value;
	if (!NUMERIC.test(value)) return value;
	return UNITLESS.has(property) ? value : `${value}px`;
}

function styleProps(style: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [property, value] of Object.entries(style)) {
		result[property] = styleValue(property, value);
	}
	return result;
}

function toCamel(property: string): string {
	if (property.startsWith("--")) return property;
	return property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** A `style="…"` attribute — what raw markup carries instead of a style object. */
function parseStyleAttribute(css: string): Record<string, string> {
	const style: Record<string, string> = {};
	for (const declaration of css.split(";")) {
		const separator = declaration.indexOf(":");
		if (separator === -1) continue;
		const property = toCamel(declaration.slice(0, separator).trim());
		const value = declaration.slice(separator + 1).trim();
		if (property !== "" && value !== "") style[property] = styleValue(property, value);
	}
	return style;
}

/**
 * What satori consumes. React elements are this shape, which is why satori
 * documents plain objects as an input alongside JSX, and why this module needs
 * no jsx runtime to produce them.
 */
type SatoriElement = {
	type: string;
	props: Record<string, unknown> & { children?: unknown };
};

type SatoriChild = SatoriElement | string;

function parseFragment(html: string): Node[] {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ultrahtml types `parse` as `any`; it returns a document node.
	const document = parse(html) as { children?: Node[] };
	return document.children ?? [];
}

/**
 * Raw markup — `Implement.Html`, and the inner content of an `Svg`, which is
 * how every lucide icon reaches us — is the one thing the render hands over
 * unparsed. An icon in the corner is most of what an og image is for, so it is
 * worth a parser: ultrahtml, which is small and has no dependencies.
 */
function fromRawMarkup(html: string): SatoriChild[] {
	const children: SatoriChild[] = [];
	for (const node of parseFragment(html)) {
		const child = fromParsedNode(node);
		if (child !== null) children.push(child);
	}
	return children;
}

function fromParsedNode(node: Node): SatoriChild | null {
	if (node.type === TEXT_NODE) {
		const text = typeof node["value"] === "string" ? node["value"] : "";
		return text === "" ? null : text;
	}
	if (node.type !== ELEMENT_NODE) return null;
	const props: Record<string, unknown> = {};
	for (const [name, value] of Object.entries(node.attributes)) {
		if (name === "style") props["style"] = parseStyleAttribute(value);
		else props[name] = value;
	}
	const children: SatoriChild[] = [];
	for (const child of node.children) {
		const mapped = fromParsedNode(child);
		if (mapped !== null) children.push(mapped);
	}
	if (children.length > 0) props["children"] = collapse(children);
	return { type: node.name, props };
}

/** One child is passed as itself, matching what a JSX runtime hands React. */
function collapse(children: SatoriChild[]): SatoriChild | SatoriChild[] {
	return children.length === 1 ? children[0]! : children;
}

function fromRenderedNode(node: RenderedNode): SatoriChild | SatoriChild[] | null {
	if (node.kind === "text") return node.text === "" ? null : node.text;
	if (node.kind === "raw") {
		const children = fromRawMarkup(node.html);
		return children.length === 0 ? null : children;
	}
	const props: Record<string, unknown> = { ...node.attributes };
	const style = styleProps(node.style);
	if (Object.keys(style).length > 0) props["style"] = style;
	const children = fromRenderedNodes(node.children);
	if (children.length > 0) props["children"] = collapse(children);
	return { type: node.tag, props };
}

function fromRenderedNodes(nodes: RenderedNode[]): SatoriChild[] {
	const children: SatoriChild[] = [];
	for (const node of nodes) {
		const child = fromRenderedNode(node);
		if (child === null) continue;
		if (Array.isArray(child)) children.push(...child);
		else children.push(child);
	}
	return children;
}

/**
 * Renders implement children into the element tree satori takes. Exported for
 * tests and for anything that wants the tree without the response around it.
 */
export function toSatoriElement(children: Child | Child[]): SatoriElement {
	const tree = renderToTree(children);
	const mapped = fromRenderedNodes(tree.children);
	// satori renders one root; more than one (or none) is wrapped so the image
	// is still what the author laid out rather than an error about arity
	const only = mapped.length === 1 ? mapped[0] : undefined;
	if (only !== undefined && typeof only !== "string") return only;
	return {
		type: "div",
		props: {
			style: { display: "flex", width: "100%", height: "100%" },
			children: collapse(mapped),
		},
	};
}

const EMOJI_SOURCES: Record<EmojiType, (code: string) => string> = {
	twemoji: (code) =>
		`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code.toLowerCase()}.svg`,
	openmoji: (code) =>
		`https://cdn.jsdelivr.net/npm/@svgmoji/openmoji@2.0.0/svg/${code.toUpperCase()}.svg`,
	blobmoji: (code) =>
		`https://cdn.jsdelivr.net/npm/@svgmoji/blob@2.0.0/svg/${code.toUpperCase()}.svg`,
	noto: (code) =>
		`https://cdn.jsdelivr.net/gh/svgmoji/svgmoji/packages/svgmoji__noto/svg/${code.toUpperCase()}.svg`,
	fluent: (code) =>
		`https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${code.toLowerCase()}_color.svg`,
	fluentFlat: (code) =>
		`https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${code.toLowerCase()}_flat.svg`,
};

const ZERO_WIDTH_JOINER = "‍";
const VARIATION_SELECTOR_16 = /️/g;

/**
 * The emoji filename convention every one of these cdns uses: code points,
 * hyphen-joined, lowercase hex — with the presentation selector dropped unless
 * the sequence is joined, where it is significant.
 */
export function emojiCode(grapheme: string): string {
	const source = grapheme.includes(ZERO_WIDTH_JOINER)
		? grapheme
		: grapheme.replace(VARIATION_SELECTOR_16, "");
	const points: string[] = [];
	for (const character of source) points.push(character.codePointAt(0)!.toString(16));
	return points.join("-");
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** Satori asks for an emoji by grapheme; it gets back an image to draw in its place. */
function emojiLoader(emoji: EmojiType) {
	const source = EMOJI_SOURCES[emoji];
	return async (code: string, grapheme: string): Promise<string | OgFont[]> => {
		// satori asks for fonts by language code too, which we have nothing to add to
		if (code !== "emoji") return [];
		const response = await fetch(source(emojiCode(grapheme)));
		if (!response.ok) return [];
		const svg = new Uint8Array(await response.arrayBuffer());
		return `data:image/svg+xml;base64,${toBase64(svg)}`;
	};
}

/** The vendored Inter subset, loaded only when a caller passes no fonts of its own. */
async function defaultFonts(): Promise<OgFont[]> {
	const { INTER_REGULAR } = await import("./og-font.ts");
	return [{ name: "Inter", data: INTER_REGULAR(), weight: 400, style: "normal" }];
}

type SatoriRenderOptions = {
	width: number;
	height: number;
	fonts: OgFont[];
	debug?: boolean;
	tailwindConfig?: Record<string, unknown>;
	loadAdditionalAsset?: (code: string, grapheme: string) => Promise<string | OgFont[]>;
};

/**
 * Satori and resvg are both loaded on demand. Neither belongs in a route's
 * module graph until something actually renders an image, and resvg's native
 * binding in particular must not be reached for on a host that cannot load it
 * — a static build renders every image at build time and never ships it.
 */
async function renderSvg(element: SatoriElement, options: SatoriRenderOptions): Promise<string> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- satori's own types pull in react's; the shape used here is the documented one.
	const satori = (await import("satori")).default as unknown as (
		element: unknown,
		options: SatoriRenderOptions,
	) => Promise<string>;
	return await satori(element, options);
}

async function renderPng(svg: string, width: number): Promise<Uint8Array> {
	const { Resvg } = await import("@resvg/resvg-js");
	const rendered = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render();
	return new Uint8Array(rendered.asPng());
}

/** Development skips the immutable cache, the same way `@vercel/og` does. */
function cacheControl(): string {
	const development = typeof process !== "undefined" && process.env?.["NODE_ENV"] === "development";
	return development ? "no-cache, no-store" : "public, immutable, no-transform, max-age=31536000";
}

/**
 * A `Response` whose body is the rendered image.
 *
 * The constructor is synchronous — the render happens as the body is read, so
 * this can be returned directly from a handler, and a failure surfaces when
 * the caller consumes the body (the prerenderer reports it as a failed route,
 * a server as a broken response).
 */
export class ImageResponse extends Response {
	constructor(element: Child | Child[], options: ImageResponseOptions = {}) {
		const {
			width = 1200,
			height = 630,
			fonts,
			emoji,
			debug,
			format = "png",
			tailwindConfig,
			headers,
			...init
		} = options;

		const body = new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					const svg = await renderSvg(toSatoriElement(element), {
						width,
						height,
						fonts: fonts !== undefined && fonts.length > 0 ? fonts : await defaultFonts(),
						debug,
						tailwindConfig,
						loadAdditionalAsset: emoji === undefined ? undefined : emojiLoader(emoji),
					});
					controller.enqueue(
						format === "svg" ? new TextEncoder().encode(svg) : await renderPng(svg, width),
					);
					controller.close();
				} catch (error) {
					controller.error(error);
				}
			},
		});

		const merged = new Headers(headers);
		if (!merged.has("content-type")) {
			merged.set("content-type", format === "svg" ? "image/svg+xml" : "image/png");
		}
		if (!merged.has("cache-control")) merged.set("cache-control", cacheControl());
		super(body, { ...init, headers: merged });
	}
}

export {
	B,
	Br,
	Code,
	Div,
	Em,
	H1,
	H2,
	H3,
	H4,
	H5,
	H6,
	I,
	Img,
	Li,
	ogElement,
	Ol,
	P,
	Pre,
	Span,
	Strong,
	Ul,
	type OgElementProps,
} from "./og-elements.ts";
