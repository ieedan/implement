import fs from "node:fs";

/**
 * The tags that get an element helper.
 *
 * Not quite every HTML tag: `html`, `head`, `body`, `base` and `noscript` are
 * deliberately absent, so do not add them back from a spec list. An app never
 * builds those — the document shell is a static `index.html`, `App({ target })`
 * mounts into an element that already exists, `ImplementHead` owns head content
 * through its own `Title`/`Meta`/`Link`/`Script`/`Style`, and the server DOM
 * constructs `head` and `body` itself. Exporting them bought nothing and cost
 * something concrete: `Html` collided with the `Html(markup)` helper, which the
 * index re-exports over the top of this module, so the same name meant two
 * different functions depending on which path you imported it from.
 */
export const HTML_TAGS = [
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
] as const;

let content = `// generated from ./scripts/seed-components.ts

import { element } from "./index";

`;

for (const tag of HTML_TAGS) {
	const name = `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}`;
	content += `export const ${name} = /* @__PURE__ */ element("${tag}");\n`;
}

fs.writeFileSync(new URL("../src/components/elements.ts", import.meta.url), content);
