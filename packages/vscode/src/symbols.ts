// What calling each of implement's components looks like.
//
// The first argument is not uniform across the library, so this cannot be a
// rule like "capitalized identifier, insert `{}`". `Svg(source, props)` takes a
// string first, `If(condition, ...)` takes a condition, and every Lucide icon
// takes props with no children at all. So: an explicit table.
//
// It is keyed on (module specifier, exported name) rather than on the local
// name, because the two entry points expose different sets: the helpers live
// only on the root, so `If` reached through `@implementjs/core/elements` is not
// the helper — it is nothing at all.

import { ELEMENTS, VOID_ELEMENTS } from "./elements.ts";

/** A written-out snippet, for a helper whose first argument is not props. */
export interface Snippet {
	template: string;
	preview: string;
}

/**
 * `propsChildren` and `propsOnly` take a props object first. `noArgs` and
 * `unknownArgs` take something we will not guess at — they earn a suggestion
 * only when there is a trailing comma to add. `null` means known and
 * deliberately not offered.
 */
export type Shape = "propsChildren" | "propsOnly" | "noArgs" | "unknownArgs" | Snippet | null;

function elementTable(): Record<string, Shape> {
	const table: Record<string, Shape> = {};
	for (const name of ELEMENTS) {
		table[name] = VOID_ELEMENTS.has(name) ? "propsOnly" : "propsChildren";
	}
	return table;
}

const snippet = (template: string, preview: string): Snippet => ({ template, preview });

// The capitalized value exports of `@implementjs/core` that are not elements.
// Anything absent is deliberately absent, as is anything mapped to `null`:
// `Ref` and `Router` are not components, and `ImplementSet`/`ImplementMap`
// build reactive collections rather than nodes.
const CORE_HELPERS: Record<string, Shape> = {
	App: "propsOnly", //              App({ target })
	Fragment: "propsChildren", //     Fragment(props?, ...children)
	Portal: "propsChildren", //       Portal(props, ...children)
	ImplementLifecycle: "propsChildren",
	ImplementWindow: "propsOnly",
	ImplementDocument: "propsOnly",

	// Children only: nothing to fill in, but still worth closing with a comma.
	ImplementHead: "unknownArgs",
	ImplementBoundary: "unknownArgs",

	// First argument is not props, so these get a written-out snippet.
	Await: snippet("${1:source}", "Await(source)"),
	ForEach: snippet("${1:items}, ${2:getKey}, ${3:render}", "ForEach(items, getKey, render)"),
	Html: snippet("${1:html}", "Html(html)"),
	If: snippet("${1:condition}, $2", "If(condition, )"),
	Key: snippet("${1:signal}, $2", "Key(signal, )"),
	Svg: snippet("${1:source}, {$2}", "Svg(source, {})"),
	Switch: snippet("${1:signal}", "Switch(signal)"),

	// Not components.
	ImplementEffect: null,
	ImplementMap: null,
	ImplementSet: null,
};

interface PackageRule {
	table: Record<string, Shape>;
	/** Applies to any name not in `table`. */
	fallback: Shape;
}

/**
 * A `fallback` is only correct where the package builds every component through
 * a single factory, so the shape is uniform by construction: primitives via
 * `createComponent`, lucide via `createLucideIcon`. Core gets none, because its
 * capitalized exports include non-components and helpers with other first
 * arguments.
 */
const PACKAGES: Record<string, PackageRule> = {
	"@implementjs/core": {
		table: { ...elementTable(), ...CORE_HELPERS },
		fallback: null,
	},
	"@implementjs/core/elements": {
		// Here `Html` really is the <html> element factory.
		table: elementTable(),
		fallback: null,
	},
	"@implementjs/primitives": { table: {}, fallback: "propsChildren" },
	"@implementjs/lucide": { table: {}, fallback: "propsOnly" },
	"@implementjs/formish": {
		// Props are required on all three.
		table: { Form: "propsChildren", Field: "propsChildren", FieldArray: "propsChildren" },
		fallback: null,
	},
};

/**
 * `null` means known and deliberately not offered. `undefined` means this table
 * does not cover the module — the caller may then go read the declaration.
 *
 * @param source   module specifier the name was imported from
 * @param imported the name as exported, before any alias
 */
export function shapeFor(
	source: string,
	imported: string,
	extraSources: Record<string, string> = {},
): Shape | undefined {
	const rule = PACKAGES[source];
	if (rule) {
		return imported in rule.table ? rule.table[imported] : rule.fallback;
	}

	// Exact match, or by path suffix so `@/lib/ui` also covers `../lib/ui`.
	for (const [specifier, shape] of Object.entries(extraSources)) {
		if (source === specifier || source.endsWith(specifier.replace(/^[@~]?\//, "/"))) {
			return shape === "propsOnly" || shape === "propsChildren" ? shape : null;
		}
	}
	return undefined;
}

/** Element shapes by name, for matching before the import exists. */
export const KNOWN_ELEMENT_SHAPES: Record<string, Shape> = elementTable();

export interface Construct {
	source: string;
	body: string;
	preview: string;
}

/**
 * Offered while typing the *name*, before any paren — for helpers where the
 * useful thing to write is a whole shape rather than a first argument. Both
 * paths are worth having: this fires on `If`, the table above on `If(`.
 */
export const CONSTRUCTS: Record<string, Construct> = {
	If: {
		source: "@implementjs/core",
		// IfHelper chains Then/ElseIf/Else, and Then takes children.
		body: "If($1).Then($2)",
		preview: "If(condition).Then()",
	},
	ForEach: {
		source: "@implementjs/core",
		// ForEach(items, getKey, render). `getKey` is typed (item, index) => key,
		// but one parameter is the house idiom.
		body: "ForEach($1, (item) => $2, (item, index) => $3)",
		preview: "ForEach(items, (item) => key, (item, index) => row)",
	},
};
