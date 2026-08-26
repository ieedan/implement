import type { Rule } from "eslint";
import type { Node } from "estree";
import { CORE_MODULE, importedName, isCoreHelper } from "./ast.ts";

/**
 * The tags core exports an element helper for. Mirrors
 * `packages/core/src/components/elements.ts`, where every export is
 * `element(name.toLowerCase())` with no exceptions — so a helper's imported
 * name lowercased is its tag, and this list is what separates `Div` from
 * `ForEach`.
 *
 * Falling behind core only costs a rule its reach; it cannot invent a report.
 *
 * `html`, `head`, `body`, `base` and `noscript` are absent here because they
 * are absent from core — see the note on `HTML_TAGS` in its seed script.
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
	"bdi",
	"bdo",
	"blockquote",
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
	"header",
	"hgroup",
	"hr",
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

/** Core's generic element builder, which takes its tag before its props. */
const COMPONENT = new Set(["component"]);

/** An object literal, carrying the parent link ESLint hangs off every node. */
export type PropsObject = Rule.Node & { type: "ObjectExpression" };

/** The tag named by `component()`'s first argument, when it is written out. */
function writtenTag(argument: Node | undefined): string | null {
	if (argument?.type !== "Literal" || typeof argument.value !== "string") return null;
	const tag = argument.value.toLowerCase();
	return ELEMENT_TAGS.has(tag) ? tag : null;
}

/**
 * Where an object literal sits, when it sits in element-props position at
 * all. `tag` is the element being rendered when the call names it, and `null`
 * when it does not — `component(tag, props)` is props for an element nobody
 * here can name.
 */
type ElementProps = { tag: string | null };

/**
 * Two call shapes put an object in element-props position: an element factory
 * takes its props first (`Div({ … })`), and `component()` names the tag ahead
 * of them (`component("div", { … })`). Anything else — an options bag, a row
 * on its way into a database, a test fixture — is not an element, however its
 * keys read.
 *
 * That last part is the whole reason this exists. `role` is an ordinary word,
 * so a rule that matches the key alone reports on `{ userId, role: "admin" }`
 * in a server file that never renders anything, and the only way out is a
 * disable comment.
 *
 * Props built up in a variable and passed in later are not element props by
 * this reading, and go unchecked. That costs the rules some reach on code
 * that is fine anyway, and it is the trade the rest of this package already
 * makes: an unrecognised value is left alone rather than guessed at.
 */
function elementPropsOf(context: Rule.RuleContext, object: PropsObject): ElementProps | null {
	const call = object.parent;
	if (call.type !== "CallExpression") return null;

	const [first, second] = call.arguments;

	if (first === object) {
		const tag = coreElementTag(context, call.callee);
		return tag == null ? null : { tag };
	}

	if (second === object && isCoreHelper(context, call.callee, COMPONENT)) {
		return { tag: writtenTag(first) };
	}

	return null;
}

/** True when `object` is the props argument of a call that renders an element. */
export function isElementProps(context: Rule.RuleContext, object: PropsObject): boolean {
	return elementPropsOf(context, object) != null;
}

/**
 * The tag `object` is props for. `null` both when it is not element props and
 * when it is but the call does not say which element — the callers here have
 * nothing to say in either case.
 */
export function elementPropsTag(context: Rule.RuleContext, object: PropsObject): string | null {
	return elementPropsOf(context, object)?.tag ?? null;
}
