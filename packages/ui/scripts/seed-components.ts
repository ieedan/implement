import fs from "node:fs";

export const HTML_TAGS = [
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
] as const;

const CUSTOM_COMPONENTS: Record<string, string> = {
	button: `export { _button, Button } from "./button";\n\n`,
	input: `export { _input, Input } from "./input";\n\n`,
	select: `export { _select, Select } from "./select";\n\n`,
	textarea: `export { _textarea, Textarea } from "./textarea";\n\n`,
};

let content = `// generated from ./scripts/seed-components.ts

import { Component } from "../component";
import type { Mountable } from "../mountable";

`;

for (const tag of HTML_TAGS) {
	const custom = CUSTOM_COMPONENTS[tag];
	if (custom) {
		content += custom;
		continue;
	}

	const newName = `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}`;
	content += `export class _${tag} extends Component<"${tag}"> {
	constructor(...components: Mountable[]) {
		super("${tag}", ...components);
	}
}

export function ${newName}(...components: Mountable[]) {
	return new _${tag}(...components);
}

`;
}

fs.writeFileSync("./src/components/index.ts", content);
