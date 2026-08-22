import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { importEdit, suggest, type Options, type Suggestion } from "../src/analyze.ts";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A real file in this repo. The local-component cases resolve against it, so
 * they assert the signatures those components actually have.
 */
const HOME = resolve(here, "../../../apps/docs/src/lib/views/home.ts");

const CORE = 'import { Div, Span, Img, Html, Svg, If } from "@implementjs/core";\n';

/** Expand a snippet body, marking tab stop 1 with `|`. */
function expand(body: string): string {
	return body
		.replace(/\$\{1:([^}]*)\}/g, "|$1")
		.replace(/\$1(?!\d)/g, "|")
		.replace(/\$\{\d+:([^}]*)\}/g, "$1")
		.replace(/\$\d+/g, "");
}

/** Apply a suggestion to the source, so a case reads as the text it produces. */
function applied(source: string, suggestion: Suggestion | undefined): string | null {
	if (!suggestion) return null;
	const text = source.replace("|", "");
	const line = text.slice(0, suggestion.replace.start).lastIndexOf("\n") + 1;
	const lineEnd = text.indexOf("\n", suggestion.replace.end);
	return (
		text.slice(line, suggestion.replace.start) +
		expand(suggestion.body) +
		text.slice(suggestion.replace.end, lineEnd === -1 ? undefined : lineEnd)
	);
}

/** Run `suggest` on source with a `|` cursor marker. */
function run(source: string, options: Partial<Options> = {}): Suggestion[] {
	const offset = source.indexOf("|");
	if (offset === -1) throw new Error("fixture needs a | cursor marker");
	return suggest(source.replace("|", ""), offset, options);
}

function props(source: string, options: Partial<Options> = {}): string | null {
	return applied(
		source,
		run(source, options).find((s) => s.kind === "props"),
	);
}

function construct(source: string, options: Partial<Options> = {}): string | null {
	return applied(
		source,
		run(source, options).find((s) => s.kind === "construct"),
	);
}

describe("elements", () => {
	it("offers props and children at statement level, with no comma", () => {
		expect(props(`${CORE}export function Page() {\n\treturn Div(|)\n}`)).toBe(
			"\treturn Div({}, |)",
		);
	});

	it("closes a nested call with a comma", () => {
		expect(props(`${CORE}export function Page() {\n\treturn Div(\n\t\tSpan(|)\n\t)\n}`)).toBe(
			"\t\tSpan({}, |),",
		);
	});

	it("closes a call in an array literal with a comma", () => {
		expect(props(`${CORE}const rows = [Div(|)]`)).toBe("const rows = [Div({}, |),]");
	});

	it("gives a void element props and no children", () => {
		expect(props(`${CORE}const logo = Img(|)`)).toBe("const logo = Img({|})");
	});

	it("does not add a comma inside an object literal", () => {
		expect(props(`${CORE}const o = { child: Div(|) }`)).toBe("const o = { child: Div({}, |) }");
	});

	it("ignores a lowercase call", () => {
		expect(props(`${CORE}const x = signal(|)`)).toBeNull();
	});
});

describe("helpers whose first argument is not props", () => {
	it("writes out Svg", () => {
		expect(props(`${CORE}const icon = Svg(|)`)).toBe("const icon = Svg(|source, {})");
	});

	it("writes out If", () => {
		expect(props(`${CORE}const gate = If(|)`)).toBe("const gate = If(|condition, )");
	});

	it("names all three ForEach arguments", () => {
		expect(props('import { ForEach } from "@implementjs/core";\nconst l = ForEach(|)')).toBe(
			"const l = ForEach(|items, getKey, render)",
		);
	});
});

describe("the import path decides the shape", () => {
	it("treats Html from core as the markup helper", () => {
		expect(props(`${CORE}const raw = Html(|)`)).toBe("const raw = Html(|html)");
	});

	// Core exports no `<html>` factory, so the subpath has no `Html` at all.
	// The two entry points still differ — the helpers live only on the root —
	// which is why the table stays keyed on the specifier.
	it("offers nothing for Html from core/elements", () => {
		expect(
			props('import { Html } from "@implementjs/core/elements";\nconst page = Html(|)'),
		).toBeNull();
	});

	it("offers nothing for a helper reached through the elements subpath", () => {
		expect(
			props('import { If } from "@implementjs/core/elements";\nconst gate = If(|)'),
		).toBeNull();
	});

	it("gives Lucide icons props and no children", () => {
		expect(
			props('import { ChevronDown } from "@implementjs/lucide";\nconst i = ChevronDown(|)'),
		).toBe("const i = ChevronDown({|})");
	});

	it("gives primitives the element convention", () => {
		expect(
			props('import { Accordion } from "@implementjs/primitives";\nconst a = Accordion(|)'),
		).toBe("const a = Accordion({}, |)");
	});

	it("requires props on formish Field", () => {
		expect(props('import { Field } from "@implementjs/formish";\nconst f = Field(|)')).toBe(
			"const f = Field({}, |)",
		);
	});

	it("keeps the exported name's shape through an alias", () => {
		expect(props('import { Div as Box } from "@implementjs/core";\nconst b = Box(|)')).toBe(
			"const b = Box({}, |)",
		);
	});

	it("leaves an unrelated package alone", () => {
		expect(props('import { Button } from "some-ui-kit";\nconst b = Button(|)')).toBeNull();
	});
});

describe("names bound elsewhere", () => {
	it("does not treat a type-only import as a value", () => {
		expect(props('import type { Div } from "@implementjs/core";\nconst d = Div(|)')).toBeNull();
	});

	it("leaves a locally declared function alone", () => {
		expect(props("function Table(props) {\n\treturn null;\n}\nconst t = Table(|)")).toBeNull();
	});

	it("leaves a locally declared binding alone", () => {
		expect(props("const Header = createThing();\nconst h = Header(|)")).toBeNull();
	});
});

describe("matching before the import exists", () => {
	it("matches an unimported element by default", () => {
		expect(props("const logo = Img(|)")).toBe("const logo = Img({|})");
	});

	it("does not reach a name that is not an element", () => {
		expect(props("const icon = Svg(|)")).toBeNull();
	});

	it("can be switched off", () => {
		expect(props("const d = Div(|)", { requireImport: true })).toBeNull();
	});
});

describe("components in this project", () => {
	it("reads a props parameter", () => {
		expect(
			props('import { Logo } from "../components/logo";\nconst l = Logo(|)', {
				fileName: HOME,
			}),
		).toBe("const l = Logo({|})");
	});

	it("reads props plus a rest parameter", () => {
		expect(props('import { Link } from "../router";\nconst l = Link(|)', { fileName: HOME })).toBe(
			"const l = Link({}, |)",
		);
	});

	it("reads destructured props through a path alias", () => {
		expect(
			props('import { Toaster } from "@/lib/components/ui/toast";\nconst t = Toaster(|)', {
				fileName: HOME,
			}),
		).toBe("const t = Toaster({|})");
	});

	it("closes a zero-argument component with a comma when nested", () => {
		expect(
			props(
				'import { SiteHeader } from "../components/site-header";\nconst x = Div(\n\tSiteHeader(|)\n)',
				{ fileName: HOME },
			),
		).toBe("\tSiteHeader(),");
	});

	it("offers nothing for a zero-argument component at statement level", () => {
		expect(
			props('import { SiteHeader } from "../components/site-header";\nconst h = SiteHeader(|)', {
				fileName: HOME,
			}),
		).toBeNull();
	});

	it("puts the cursor inside a non-props component when nested", () => {
		expect(
			props(
				'import { Typeset } from "@/lib/components/docs/typeset";\nconst x = Div(\n\tTypeset(|)\n)',
				{ fileName: HOME },
			),
		).toBe("\tTypeset(|),");
	});

	it("offers nothing for a non-props component at statement level", () => {
		expect(
			props('import { Typeset } from "@/lib/components/docs/typeset";\nconst t = Typeset(|)', {
				fileName: HOME,
			}),
		).toBeNull();
	});

	it("does nothing without a file to resolve against", () => {
		expect(props('import { Logo } from "../components/logo";\nconst l = Logo(|)')).toBeNull();
	});

	it("can be switched off", () => {
		expect(
			props('import { Logo } from "../components/logo";\nconst l = Logo(|)', {
				fileName: HOME,
				resolveLocalComponents: false,
			}),
		).toBeNull();
	});
});

describe("nesting detection", () => {
	it("is not fooled by brackets in a string", () => {
		expect(props(`${CORE}const s = "((";\nexport function P() {\n\treturn Div(|)\n}`)).toBe(
			"\treturn Div({}, |)",
		);
	});

	it("is not fooled by brackets in a comment", () => {
		expect(props(`${CORE}// Div(\nexport function P() {\n\treturn Div(|)\n}`)).toBe(
			"\treturn Div({}, |)",
		);
	});

	it("is not fooled by template interpolation", () => {
		expect(
			props(`${CORE}const t = \`a \${ 1 } b\`;\nexport function P() {\n\treturn Div(|)\n}`),
		).toBe("\treturn Div({}, |)");
	});
});

describe("constructs", () => {
	it("offers the Then chain for If", () => {
		expect(construct('import { If } from "@implementjs/core";\nconst gate = If|')).toBe(
			"const gate = If(|).Then()",
		);
	});

	it("offers key and row callbacks for ForEach", () => {
		expect(construct('import { ForEach } from "@implementjs/core";\nconst list = ForEach|')).toBe(
			"const list = ForEach(|, (item) => , (item, index) => )",
		);
	});

	it("matches on a prefix", () => {
		expect(construct('import { If } from "@implementjs/core";\nconst gate = I|')).toBe(
			"const gate = If(|).Then()",
		);
	});

	it("takes the trailing comma when nested", () => {
		expect(
			construct('import { Div, If } from "@implementjs/core";\nconst x = Div(\n\tIf|\n)'),
		).toBe("\tIf(|).Then(),");
	});

	it("ignores a property access", () => {
		expect(construct('import { If } from "@implementjs/core";\nconst x = helper.If|')).toBeNull();
	});

	it("leaves an already-opened call to the paren path", () => {
		expect(construct('import { If } from "@implementjs/core";\nconst x = If|(')).toBeNull();
	});

	it("yields to a locally declared name", () => {
		expect(construct("function If(x) {\n\treturn x;\n}\nconst y = If|")).toBeNull();
	});

	it("does not match a lowercase prefix", () => {
		expect(construct('import { If } from "@implementjs/core";\nconst x = if|')).toBeNull();
	});

	it("can be switched off", () => {
		expect(
			construct('import { If } from "@implementjs/core";\nconst gate = If|', {
				constructs: false,
			}),
		).toBeNull();
	});
});

describe("import edits", () => {
	const CORE_SOURCE = "@implementjs/core";

	it("extends an existing import from the same module", () => {
		expect(importEdit('import { Div } from "@implementjs/core";\n', "If", CORE_SOURCE)).toEqual({
			offset: 9,
			text: "If, ",
		});
	});

	it("adds a statement when there is none", () => {
		expect(importEdit("const x = 1;\n", "If", CORE_SOURCE)).toEqual({
			offset: 0,
			text: 'import { If } from "@implementjs/core";\n',
		});
	});

	it("does nothing when already imported", () => {
		expect(importEdit('import { If } from "@implementjs/core";\n', "If", CORE_SOURCE)).toBeNull();
	});

	it("does nothing when a type-only import binds the name", () => {
		expect(
			importEdit('import type { If } from "@implementjs/core";\n', "If", CORE_SOURCE),
		).toBeNull();
	});
});
