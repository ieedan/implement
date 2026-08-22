// Reading the signature of a component that lives in the user's project.
//
// The curated table in symbols.ts covers the framework's own packages. Anything
// else — the user's components — has to be read off the declaration, because
// local components are not uniformly props-first. In this repo's docs app:
//
//   Logo(props: SvgProps = {})                     props
//   Link: LinkFn = (props, ...children) => ...     props + children
//   Toaster({ manager, ...props })                 props (destructured)
//   Typeset(content: string, className?: string)   not props
//   TabsBlock(panels: TabPanel[])                  not props
//   SiteHeader()                                   no arguments
//
// So this resolves the import to a file, finds the declaration, and reports
// what the first parameter actually is. Bare specifiers are not followed:
// node_modules means .d.ts parsing, and the packages worth knowing about are
// already in the table.

import fs from "node:fs";
import path from "node:path";

import type { Shape } from "./symbols.ts";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const MAX_FILE_BYTES = 1_000_000;
const MAX_REEXPORT_DEPTH = 3;
const MAX_TSCONFIG_WALK = 8;

// ------------------------------------------------------------------ jsonc ---

/** Strip comments and trailing commas so a tsconfig parses as JSON. */
export function stripJsonc(text: string): string {
	let out = "";
	let i = 0;
	const n = text.length;
	while (i < n) {
		const c = text[i];
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
		if (c === '"') {
			out += c;
			i++;
			while (i < n) {
				out += text[i];
				if (text[i] === "\\") {
					out += text[i + 1] ?? "";
					i += 2;
					continue;
				}
				if (text[i] === '"') {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		out += c;
		i++;
	}
	return out.replace(/,(\s*[}\]])/g, "$1");
}

// ------------------------------------------------------------------- cache ---

// Two caches rather than one generic one, so neither read has to assert its
// way back out of a shared `unknown`.
const textCache = new Map<string, { mtimeMs: number; value: string | null }>();
const configCache = new Map<string, { mtimeMs: number; value: TsconfigShape | null }>();

/** The stat of a readable, reasonably sized file, or null. */
function statOf(file: string): fs.Stats | null {
	try {
		const stat = fs.statSync(file);
		return stat.isFile() && stat.size <= MAX_FILE_BYTES ? stat : null;
	} catch {
		return null;
	}
}

function readRaw(file: string): string | null {
	try {
		return fs.readFileSync(file, "utf8");
	} catch {
		return null;
	}
}

/** Read a file, re-reading only when its mtime moves. */
function readText(file: string): string | null {
	const stat = statOf(file);
	if (!stat) return null;

	const cached = textCache.get(file);
	if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;

	const value = readRaw(file);
	textCache.set(file, { mtimeMs: stat.mtimeMs, value });
	return value;
}

// -------------------------------------------------------- tsconfig `paths` ---

interface PathMapping {
	pattern: string;
	targets: string[];
}

interface TsconfigShape {
	extends?: string | string[];
	compilerOptions?: {
		baseUrl?: string;
		paths?: Record<string, string[]>;
	};
}

/**
 * Read the fields we care about off a parsed tsconfig. Everything is checked
 * rather than asserted, since a tsconfig is user input and `extends` chains
 * reach files this package has never seen.
 */
function toTsconfig(parsed: unknown): TsconfigShape | null {
	if (typeof parsed !== "object" || parsed === null) return null;
	const root: Record<string, unknown> = Object.fromEntries(Object.entries(parsed));

	const shape: TsconfigShape = {};
	if (typeof root.extends === "string") shape.extends = root.extends;
	else if (Array.isArray(root.extends)) {
		shape.extends = root.extends.filter((e): e is string => typeof e === "string");
	}

	const options = root.compilerOptions;
	if (typeof options === "object" && options !== null) {
		const compiler: Record<string, unknown> = Object.fromEntries(Object.entries(options));
		shape.compilerOptions = {};
		if (typeof compiler.baseUrl === "string") shape.compilerOptions.baseUrl = compiler.baseUrl;
		if (typeof compiler.paths === "object" && compiler.paths !== null) {
			const paths: Record<string, string[]> = {};
			for (const [pattern, targets] of Object.entries(compiler.paths)) {
				if (!Array.isArray(targets)) continue;
				paths[pattern] = targets.filter((t): t is string => typeof t === "string");
			}
			shape.compilerOptions.paths = paths;
		}
	}
	return shape;
}

function readTsconfig(file: string): TsconfigShape | null {
	const stat = statOf(file);
	if (!stat) return null;

	const cached = configCache.get(file);
	if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;

	const raw = readRaw(file);
	let value: TsconfigShape | null = null;
	if (raw !== null) {
		try {
			value = toTsconfig(JSON.parse(stripJsonc(raw)));
		} catch {
			value = null;
		}
	}
	configCache.set(file, { mtimeMs: stat.mtimeMs, value });
	return value;
}

/**
 * Path mappings visible from `fromFile`, as absolute target prefixes. Targets
 * resolve against the directory of the tsconfig that *declared* them, which is
 * why `extends` is followed rather than flattened: this repo's docs app
 * declares `@/*` in .implement/tsconfig.json, so `@/lib/x` is src/lib/x.
 */
export function loadPathMappings(fromFile: string): PathMapping[] {
	let dir = path.dirname(fromFile);
	for (let step = 0; step < MAX_TSCONFIG_WALK; step++) {
		const candidate = path.join(dir, "tsconfig.json");
		if (fs.existsSync(candidate)) return collectPaths(candidate, new Set());
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return [];
}

function collectPaths(tsconfigFile: string, seen: Set<string>): PathMapping[] {
	if (seen.has(tsconfigFile) || seen.size > MAX_TSCONFIG_WALK) return [];
	seen.add(tsconfigFile);

	const config = readTsconfig(tsconfigFile);
	if (!config) return [];

	const dir = path.dirname(tsconfigFile);
	const baseUrl = config.compilerOptions?.baseUrl ?? ".";
	const own: PathMapping[] = [];
	for (const [pattern, targets] of Object.entries(config.compilerOptions?.paths ?? {})) {
		if (!Array.isArray(targets)) continue;
		own.push({ pattern, targets: targets.map((t) => path.resolve(dir, baseUrl, t)) });
	}

	// Own mappings win over inherited ones, matching tsc.
	const inherited: PathMapping[] = [];
	const field = config.extends;
	const parents = Array.isArray(field) ? field : field ? [field] : [];
	for (const parent of parents) {
		if (!parent.startsWith(".")) continue; // package-name extends: not followed
		let resolved = path.resolve(dir, parent);
		if (!resolved.endsWith(".json")) resolved += ".json";
		inherited.push(...collectPaths(resolved, seen));
	}

	return [...own, ...inherited];
}

export function applyPathMappings(specifier: string, mappings: PathMapping[]): string[] {
	const out: string[] = [];
	for (const { pattern, targets } of mappings) {
		const star = pattern.indexOf("*");
		if (star === -1) {
			if (specifier === pattern) out.push(...targets);
			continue;
		}
		const head = pattern.slice(0, star);
		const tail = pattern.slice(star + 1);
		if (!specifier.startsWith(head) || !specifier.endsWith(tail)) continue;
		const middle = specifier.slice(head.length, specifier.length - tail.length);
		out.push(...targets.map((t) => t.replace("*", middle)));
	}
	return out;
}

// -------------------------------------------------------------- resolution ---

function tryFile(base: string): string | null {
	const ext = path.extname(base);
	if (ext) {
		if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
		// `./x.js` in TypeScript source usually means `./x.ts`.
		const stem = base.slice(0, -ext.length);
		for (const candidate of EXTENSIONS.map((e) => stem + e)) {
			if (fs.existsSync(candidate)) return candidate;
		}
	}
	for (const candidate of EXTENSIONS.map((e) => base + e)) {
		if (fs.existsSync(candidate)) return candidate;
	}
	for (const candidate of EXTENSIONS.map((e) => path.join(base, `index${e}`))) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

/** Absolute path for `specifier` imported from `fromFile`, or null. */
export function resolveModule(specifier: string, fromFile: string): string | null {
	if (specifier.startsWith(".")) {
		return tryFile(path.resolve(path.dirname(fromFile), specifier));
	}
	if (specifier.startsWith("/")) return tryFile(specifier);

	// A bare specifier is either a path alias or a package. Aliases only.
	for (const base of applyPathMappings(specifier, loadPathMappings(fromFile))) {
		const hit = tryFile(base);
		if (hit) return hit;
	}
	return null;
}

// ----------------------------------------------------------------- parsing ---

/** From an opening bracket, the text up to its match. */
function balanced(text: string, openIndex: number): string | null {
	const open = text[openIndex];
	const close = open === "(" ? ")" : open === "[" ? "]" : "}";
	let depth = 0;
	for (let i = openIndex; i < text.length; i++) {
		const c = text[i];
		if (c === open) depth++;
		else if (c === close) {
			depth--;
			if (depth === 0) return text.slice(openIndex + 1, i);
		}
	}
	return null;
}

/**
 * Split a parameter list on top-level commas. `=>` is stepped over as a unit so
 * a function-typed parameter such as `render: (item: T) => Child` does not
 * unbalance the angle-bracket depth.
 */
export function splitParams(src: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (c === "=" && src[i + 1] === ">") {
			i++;
			continue;
		}
		if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
		else if (c === ")" || c === "]" || c === "}" || c === ">") depth--;
		else if (c === "," && depth === 0) {
			parts.push(src.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(src.slice(start));
	return parts.map((p) => p.trim()).filter(Boolean);
}

export interface Param {
	name: string;
	rest: boolean;
	destructured: boolean;
	optional: boolean;
}

export function describeParams(src: string): Param[] {
	return splitParams(src).map((raw) => {
		const rest = raw.startsWith("...");
		const body = rest ? raw.slice(3).trim() : raw;
		const destructured = body.startsWith("{");
		const head = (body.split(/[:=]/)[0] ?? "").trim();
		const name = destructured ? "props" : head.replace(/\?$/, "");
		const optional = /\?\s*:/.test(body) || head.endsWith("?") || /[^=!<>]=[^=>]/.test(body);
		return { name, rest, destructured, optional };
	});
}

/** What calling a component with this parameter list looks like. */
export function classify(params: Param[]): Shape {
	if (!params.length) return "noArgs";
	const first = params[0];
	if (first && !first.rest && (first.name === "props" || first.destructured)) {
		return params.some((p) => p.rest) ? "propsChildren" : "propsOnly";
	}
	return "unknownArgs";
}

/** Find `name`'s declaration in `text` and classify it, or null. */
export function classifyDeclaration(text: string, name: string): Shape {
	const id = name.replace(/[$]/g, "\\$&");

	const fn = new RegExp(`function\\s+${id}\\s*(?:<[^(){}]*>)?\\s*\\(`).exec(text);
	if (fn) {
		const params = balanced(text, fn.index + fn[0].length - 1);
		if (params !== null) return classify(describeParams(params));
	}

	const binding = new RegExp(`(?:const|let|var)\\s+${id}\\b`).exec(text);
	if (binding) {
		const after = text.slice(binding.index + binding[0].length);
		const assign = /^[^=\n]*=\s*/.exec(after);
		if (assign) {
			let rhs = after.slice(assign[0].length).replace(/^\/\*[\s\S]*?\*\/\s*/, "");
			// Components built through the primitives factory are props + children
			// by construction.
			if (/^createComponent\s*[(<]/.test(rhs)) return "propsChildren";
			rhs = rhs.replace(/^async\s+/, "").replace(/^<[^(){}]*>\s*/, "");
			if (rhs.startsWith("(")) {
				const params = balanced(rhs, 0);
				if (params !== null) return classify(describeParams(params));
			}
		}
	}

	return null;
}

/** The specifier `name` is re-exported from, if this file only forwards it. */
function reexportSource(text: string, name: string): string | null {
	const id = name.replace(/[$]/g, "\\$&");
	const re = new RegExp(`export\\s*\\{([^}]*\\b${id}\\b[^}]*)\\}\\s*from\\s*["']([^"']+)["']`);
	return re.exec(text)?.[2] ?? null;
}

// ------------------------------------------------------------------- entry ---

/**
 * Classify `imported` as exported from `specifier`, seen from `fromFile`.
 * Returns null when it cannot be determined.
 */
export function classifyImport(
	specifier: string,
	imported: string,
	fromFile: string,
	depth = 0,
): Shape {
	if (depth > MAX_REEXPORT_DEPTH) return null;

	const file = resolveModule(specifier, fromFile);
	if (!file) return null;

	const text = readText(file);
	if (text === null) return null;

	const direct = classifyDeclaration(text, imported);
	if (direct) return direct;

	const forwarded = reexportSource(text, imported);
	if (forwarded) return classifyImport(forwarded, imported, file, depth + 1);

	return null;
}

export function clearCaches(): void {
	textCache.clear();
	configCache.clear();
}
