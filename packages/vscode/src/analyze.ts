// Deciding what to suggest, in terms of plain text and offsets.
//
// Nothing here imports `vscode`. The editor layer in extension.ts converts
// offsets to positions and suggestions to completion items, which keeps this
// half runnable — and testable — on its own.

import { classifyImport } from "./signatures.ts";
import { CONSTRUCTS, KNOWN_ELEMENT_SHAPES, shapeFor, type Shape } from "./symbols.ts";

/** `Div(` at the end of the text before the cursor, capturing the name. */
const CALL = /([A-Z][A-Za-z0-9_$]*)\($/;

/** A capitalized identifier being typed at the cursor. */
const WORD = /([A-Z][A-Za-z0-9_$]*)$/;

/** Named-import statements. Group 1 is set when the statement is `import type`. */
const IMPORT = /import\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;

/** `function Foo`, `class Foo`, `const Foo =` — capitalized declarations only. */
const DECLARATION =
	/(?:^|[\n;{}])\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s+|class\s+|(?:const|let|var)\s+)([A-Z][A-Za-z0-9_$]*)/g;

export interface Options {
	/** Where the cursor lands for a props + children component. */
	cursor: "children" | "props";
	/** Close a nested call with a comma. */
	trailingComma: boolean;
	/** Only match names already imported. */
	requireImport: boolean;
	/** Read declarations of components imported from this project. */
	resolveLocalComponents: boolean;
	/** Offer whole-shape snippets while typing a construct's name. */
	constructs: boolean;
	/** Extra module specifiers whose exports follow a component convention. */
	extraSources: Record<string, string>;
	/** Absolute path of the file being edited, for resolving local imports. */
	fileName?: string;
}

export const DEFAULTS: Options = {
	cursor: "children",
	trailingComma: true,
	requireImport: false,
	resolveLocalComponents: true,
	constructs: true,
	extraSources: {},
};

export interface Suggestion {
	kind: "props" | "construct";
	/** The name the suggestion is for. */
	name: string;
	/** Shown in the suggest widget. */
	label: string;
	detail: string;
	documentation?: string;
	/** Snippet body, with `$1`-style tab stops. */
	body: string;
	/** Half-open offset range the body replaces. */
	replace: { start: number; end: number };
	/** What to filter the entry on, when it differs from the label. */
	filterText?: string;
	preselect?: boolean;
	/** An import to add alongside the snippet. */
	importEdit?: { offset: number; text: string };
}

// ---------------------------------------------------------------- scanning ---

export interface ImportedName {
	source: string;
	imported: string;
}

export interface FileInfo {
	/** Value imports, by local name. */
	imports: Map<string, ImportedName>;
	/** Every other capitalized name the file binds: locals and type-only imports. */
	bound: Set<string>;
}

export function scanFile(text: string): FileInfo {
	const imports = new Map<string, ImportedName>();
	const bound = new Set<string>();

	IMPORT.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = IMPORT.exec(text)) !== null) {
		const statementIsType = Boolean(match[1]);
		const source = match[3] ?? "";
		for (const raw of (match[2] ?? "").split(",")) {
			const spec = raw.trim();
			if (!spec) continue;
			const isType = statementIsType || /^type\s/.test(spec);
			const bare = spec.replace(/^type\s+/, "");
			const aliased = /^(\S+)\s+as\s+(\S+)$/.exec(bare);
			const imported = aliased?.[1] ?? bare;
			const local = aliased?.[2] ?? bare;
			// A type-only import is not a value, but it does bind the name — else
			// the unimported fallback would treat `Div` as the element after
			// `import type { Div }`.
			if (isType) bound.add(local);
			else imports.set(local, { source, imported });
		}
	}

	// A local `function Table()` is not the <table> element, and 30-odd element
	// names are plausible component names.
	DECLARATION.lastIndex = 0;
	while ((match = DECLARATION.exec(text)) !== null) {
		if (match[1]) bound.add(match[1]);
	}

	return { imports, bound };
}

/**
 * The bracket enclosing the end of `text`, or null at top level. A forward
 * lexer rather than a backward scan, because scanning backwards cannot tell a
 * string's opening quote from its closing one. Handles line and block comments,
 * all three string forms, and `${}` nesting inside templates. Regex literals
 * are not distinguished from division, so brackets inside a regex can fool it.
 */
export function enclosingBracket(text: string): string | null {
	const stack: string[] = [];
	const n = text.length;
	let i = 0;

	while (i < n) {
		const c = text[i];

		if (stack[stack.length - 1] === "`") {
			if (c === "\\") {
				i += 2;
				continue;
			}
			if (c === "`") {
				stack.pop();
				i++;
				continue;
			}
			if (c === "$" && text[i + 1] === "{") {
				stack.push("${");
				i += 2;
				continue;
			}
			i++;
			continue;
		}

		if (c === "/" && text[i + 1] === "/") {
			while (i < n && text[i] !== "\n") i++;
			continue;
		}
		if (c === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		if (c === '"' || c === "'") {
			const quote = c;
			i++;
			while (i < n) {
				if (text[i] === "\\") {
					i += 2;
					continue;
				}
				if (text[i] === quote || text[i] === "\n") {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (c === "`") {
			stack.push("`");
			i++;
			continue;
		}
		if (c === "(" || c === "[" || c === "{") {
			stack.push(c);
			i++;
			continue;
		}
		if (c === ")" || c === "]" || c === "}") {
			stack.pop();
			i++;
			continue;
		}
		i++;
	}

	const top = stack[stack.length - 1];
	if (!top) return null;
	return top === "${" ? "{" : top;
}

/** Whether a call starting at `offset` sits in an argument list or an array. */
function isNested(text: string, offset: number, options: Options): boolean {
	if (!options.trailingComma) return false;
	const bracket = enclosingBracket(text.slice(0, offset));
	return bracket === "(" || bracket === "[";
}

// ------------------------------------------------------------------ shapes ---

/**
 * The snippet body for a shape, plus the widget label. An empty body means the
 * call takes nothing — the caller decides whether a trailing comma still makes
 * it worth offering.
 */
export function fill(
	shape: Shape,
	name: string,
	cursor: Options["cursor"],
): { body: string; preview: string } | null {
	if (shape === "propsOnly") return { body: "{$1}", preview: `${name}({})` };
	if (shape === "propsChildren") {
		return {
			body: cursor === "props" ? "{$1}, $2" : "{$2}, $1",
			preview: `${name}({}, )`,
		};
	}
	if (shape === "noArgs") return { body: "", preview: `${name}()` };
	if (shape === "unknownArgs") return { body: "$1", preview: `${name}()` };
	if (shape && typeof shape === "object") {
		return { body: shape.template, preview: shape.preview };
	}
	return null;
}

/** The literal text a snippet body types, ignoring tab stops. */
function literalOf(body: string): string {
	return body.replace(/\$\{\d+:([^}]*)\}/g, "$1").replace(/\$\d+/g, "");
}

function shapeOf(name: string, info: FileInfo, options: Options): Shape | undefined {
	const entry = info.imports.get(name);
	if (entry) {
		// An import is authoritative, including when it resolves to nothing: a
		// `Table` imported from your own module is not the <table> element.
		const known = shapeFor(entry.source, entry.imported, options.extraSources);
		if (known !== undefined) return known;
		// Not one of the framework's packages, so go read the declaration.
		if (options.resolveLocalComponents && options.fileName) {
			return classifyImport(entry.source, entry.imported, options.fileName);
		}
		return undefined;
	}
	if (!options.requireImport && !info.bound.has(name)) {
		// Not imported and not declared here, so an element name is very likely
		// the element — about to be auto-imported as one.
		return KNOWN_ELEMENT_SHAPES[name];
	}
	return undefined;
}

// ------------------------------------------------------------ props suggest ---

/** The suggestion for a `(` just typed at `offset`, if any. */
function propsSuggestion(text: string, offset: number, options: Options): Suggestion | null {
	const call = CALL.exec(text.slice(0, offset));
	if (!call) return null;
	const name = call[1];
	if (!name) return null;

	const info = scanFile(text);
	const shape = shapeOf(name, info, options);
	if (!shape) return null;

	const filled = fill(shape, name, options.cursor);
	if (!filled) return null;

	// The comma belongs after the closing paren, so it can only be placed when
	// the auto-closed `)` is there for us to take over.
	const ownsParen = isNested(text, offset - 1, options) && text[offset] === ")";

	// A body of only tab stops types nothing the cursor is not already doing, so
	// a component with nothing to fill in is worth offering only for the comma.
	if (!literalOf(filled.body) && !ownsParen) return null;

	return {
		kind: "props",
		name,
		label: filled.preview,
		detail: shape === "propsOnly" ? "implement props" : "implement props + children",
		documentation: `Insert the props object for \`${name}\`.`,
		body: ownsParen ? `${filled.body}),` : filled.body,
		replace: { start: offset, end: ownsParen ? offset + 1 : offset },
		preselect: true,
	};
}

// -------------------------------------------------------- construct suggest ---

/**
 * The edit that brings `name` into scope, or null when it is already bound
 * here. Extends an existing import from the same module rather than adding a
 * second statement.
 */
export function importEdit(
	text: string,
	name: string,
	source: string,
): { offset: number; text: string } | null {
	const info = scanFile(text);
	if (info.imports.has(name) || info.bound.has(name)) return null;

	IMPORT.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = IMPORT.exec(text)) !== null) {
		if (match[1] || match[3] !== source) continue;
		const brace = text.indexOf("{", match.index);
		if (brace === -1) continue;
		let at = brace + 1;
		while (at < text.length && /\s/.test(text[at] ?? "")) at++;
		return { offset: at, text: `${name}, ` };
	}

	return { offset: 0, text: `import { ${name} } from "${source}";\n` };
}

function constructSuggestions(text: string, offset: number, options: Options): Suggestion[] {
	if (!options.constructs) return [];

	const before = text.slice(0, offset);
	const word = WORD.exec(before);
	if (!word?.[1]) return [];
	const typed = word[1];

	// `foo.If` is a property, not the helper.
	if (before[before.length - typed.length - 1] === ".") return [];
	// Mid-identifier, or already opening the call — the `(` path handles that.
	if (/[A-Za-z0-9_$(]/.test(text[offset] ?? "")) return [];

	const start = offset - typed.length;
	// Entries rather than keys, so the construct comes through typed.
	const names = Object.entries(CONSTRUCTS).filter(([name]) => name.startsWith(typed));
	if (!names.length) return [];

	const info = scanFile(text);
	const comma = isNested(text, start, options) ? "," : "";

	return names
		.filter(([name]) => !info.bound.has(name))
		.map(([name, construct]) => {
			const edit = importEdit(text, name, construct.source);
			return {
				kind: "construct" as const,
				name,
				label: construct.preview,
				detail: "implement construct",
				documentation: edit ? `Imports \`${name}\` from \`${construct.source}\`.` : undefined,
				body: construct.body + comma,
				replace: { start, end: offset },
				// Filter on the name so the entry survives as you type `If`, even
				// though the label shows the whole shape.
				filterText: name,
				importEdit: edit ?? undefined,
			};
		});
}

// ------------------------------------------------------------------- entry ---

/** Everything worth suggesting at `offset` in `text`. */
export function suggest(
	text: string,
	offset: number,
	options: Partial<Options> = {},
): Suggestion[] {
	const resolved: Options = { ...DEFAULTS, ...options };
	const out: Suggestion[] = [];
	const props = propsSuggestion(text, offset, resolved);
	if (props) out.push(props);
	out.push(...constructSuggestions(text, offset, resolved));
	return out;
}
