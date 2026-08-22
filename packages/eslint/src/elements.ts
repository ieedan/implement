import type { Rule } from "eslint";
import type { Node } from "estree";
import { CORE_MODULE, importedName } from "./ast.ts";

/**
 * The tags core exports an element helper for. Mirrors
 * `packages/core/src/components/elements.ts`, where every export is
 * `element(name.toLowerCase())` with no exceptions — so a helper's imported
 * name lowercased is its tag, and this list is what separates `Div` from
 * `ForEach`.
 *
 * Falling behind core only costs a rule its reach; it cannot invent a report.
 */
const ELEMENT_TAGS: ReadonlySet<string> = new Set([
	"a",
	"abbr",
	"address",
	"area",
	"article",
	"aside",
	"audio",
	"b",
	"base",
	"bdi",
	"bdo",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"data",
	"datalist",
	"dd",
	"del",
	"details",
	"dfn",
	"dialog",
	"div",
	"dl",
	"dt",
	"em",
	"embed",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"head",
	"header",
	"hgroup",
	"hr",
	"html",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"link",
	"main",
	"map",
	"mark",
	"menu",
	"meta",
	"meter",
	"nav",
	"noscript",
	"object",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"picture",
	"pre",
	"progress",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"script",
	"search",
	"section",
	"select",
	"slot",
	"small",
	"source",
	"span",
	"strong",
	"style",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"title",
	"tr",
	"track",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
]);

/**
 * The HTML tag a call renders, when the callee is one of core's element
 * helpers. `null` for a component, a primitive, or anything imported from
 * somewhere else — which is most calls, and why the rules that need this say
 * nothing far more often than they speak.
 */
export function coreElementTag(context: Rule.RuleContext, callee: Node): string | null {
	if (callee.type !== "Identifier") return null;
	// The imported name is what names the tag; a local alias need not match.
	const imported = importedName(context, callee, CORE_MODULE);
	if (imported == null) return null;
	const tag = imported.toLowerCase();
	return ELEMENT_TAGS.has(tag) ? tag : null;
}
