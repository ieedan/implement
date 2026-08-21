import * as implement from "@implementjs/core";
import * as formish from "@implementjs/formish";
import * as lucide from "@implementjs/lucide";
import * as modeWatcher from "@implementjs/mode-watcher";
import * as primitives from "@implementjs/primitives";
import { transform } from "sucrase";
import * as valibot from "valibot";

const IMPLEMENT = "@implementjs/core";
const FORMISH = "@implementjs/formish";
const LUCIDE = "@implementjs/lucide";
const MODE_WATCHER = "@implementjs/mode-watcher";
const PRIMITIVES = "@implementjs/primitives";
// formish validates with any Standard Schema library; valibot is the one the
// docs use, so an edited demo can import it too
const VALIBOT = "valibot";

export type ShimModule = Record<string, unknown>;

type Mounted = {
	mount: (parent: HTMLElement) => void;
	unmount: () => void;
};

const shimUrls = new Map<string, string>();

function shimKey(specifier: string): string {
	return `implementPlaygroundRuntime:${specifier}`;
}

// Bare specifiers can't resolve from a blob module, so each shimmed module is
// parked on the executing realm's globalThis and re-exported from a generated
// blob the imports are rewritten to point at. Parking happens per-import (see
// importLessonModule) because the realm may be a fresh preview iframe.
const RESERVED_IDENTIFIERS = new Set([
	"arguments",
	"await",
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"eval",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"function",
	"if",
	"implements",
	"import",
	"in",
	"instanceof",
	"interface",
	"let",
	"new",
	"null",
	"package",
	"private",
	"protected",
	"public",
	"return",
	"static",
	"super",
	"switch",
	"this",
	"throw",
	"true",
	"try",
	"typeof",
	"var",
	"void",
	"while",
	"with",
	"yield",
]);

function isExportableName(name: string): boolean {
	if (name === "default") return false;
	if (!/^[A-Za-z_$][\w$]*$/.test(name)) return false;
	return !RESERVED_IDENTIFIERS.has(name);
}

function moduleShimUrl(specifier: string, moduleObject: ShimModule): string {
	const cached = shimUrls.get(specifier);
	if (cached != null) return cached;
	const names = Object.keys(moduleObject).filter(isExportableName);
	const source = [
		`const m = globalThis[${JSON.stringify(shimKey(specifier))}];`,
		...names.map((name) => `export const ${name} = m[${JSON.stringify(name)}];`),
	].join("\n");
	const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
	shimUrls.set(specifier, url);
	return url;
}

// Evaluating the import inside the target realm makes the lesson's bare
// globals (console, window, setTimeout, alert) resolve to that realm.
function importInRealm(realm: Window, url: string): Promise<Record<string, unknown>> {
	if (realm === window) return import(/* @vite-ignore */ url);
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Preview iframe realms need dynamic import via their Function constructor. */
	const RealmFunction = (realm as Window & { Function: FunctionConstructor }).Function;
	const dynamicImport = new RealmFunction("url", "return import(url)") as (
		url: string,
	) => Promise<Record<string, unknown>>;
	return dynamicImport(url);
	/* oxlint-enable typescript/no-unsafe-type-assertion */
}

function transpile(code: string): string {
	return transform(code, {
		transforms: ["typescript"],
		disableESTransforms: true,
		production: true,
	}).code;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteImports(code: string, modules: Record<string, ShimModule>): string {
	let rewritten = code;
	for (const [specifier, moduleObject] of Object.entries(modules)) {
		rewritten = rewritten.replace(
			new RegExp(`from\\s+(["'])${escapeRegExp(specifier)}\\1`, "g"),
			`from ${JSON.stringify(moduleShimUrl(specifier, moduleObject))}`,
		);
		// Only leftover *imports* of the specifier are unresolved. A string
		// argument like Repo("@implementjs/core") must be allowed to remain.
		if (
			new RegExp(
				`(?:from\\s+|import\\s*\\(\\s*|import\\s+)(["'])${escapeRegExp(specifier)}\\1`,
			).test(rewritten)
		) {
			throw new Error(`Could not resolve "${specifier}". Import it with a string literal.`);
		}
	}
	return rewritten;
}

function isMounted(value: unknown): value is Mounted {
	if (value == null || typeof value !== "object") return false;
	if (!("mount" in value) || !("unmount" in value)) return false;
	return typeof value.mount === "function" && typeof value.unmount === "function";
}

function mountExport(exported: unknown, target: HTMLElement): Mounted {
	if (typeof exported !== "function") {
		throw new Error("Export a default function that returns your UI.");
	}

	const result: unknown = exported();
	const instance = isMounted(result) ? result : typeof result === "function" ? result() : null;

	if (!isMounted(instance)) {
		throw new Error("The default export must return a component.");
	}

	instance.mount(target);
	return instance;
}

export async function importLessonModule(
	code: string,
	extraModules: Record<string, ShimModule> = {},
	realm: Window = window,
): Promise<{ mod: Record<string, unknown>; revoke: () => void }> {
	const modules: Record<string, ShimModule> = {
		[IMPLEMENT]: implement,
		[FORMISH]: formish,
		[LUCIDE]: lucide,
		[MODE_WATCHER]: modeWatcher,
		[PRIMITIVES]: primitives,
		[VALIBOT]: valibot,
		...extraModules,
	};
	const rewritten = rewriteImports(transpile(code), modules);

	// The shim blobs read their module off globalThis at import time, so the
	// module objects must be parked on the realm that executes the import.
	for (const [specifier, moduleObject] of Object.entries(modules)) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shim modules are parked on the preview realm's globalThis.
		(realm as Window & ShimModule)[shimKey(specifier)] = moduleObject;
	}

	const url = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
	try {
		const mod = await importInRealm(realm, url);
		return { mod, revoke: () => URL.revokeObjectURL(url) };
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}
}

export type ProjectFile = { path: string; content: string };

/** `from "./x"` / `import "../y"` specifiers, the only ones linked between files. */
const RELATIVE_IMPORT = /(?:from|import)\s*(["'])(\.\.?\/[^"']+)\1/g;

function resolveRelative(fromPath: string, specifier: string, byPath: Map<string, string>): string {
	const segments = fromPath.split("/").slice(0, -1);
	for (const part of specifier.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			if (segments.length === 0) {
				throw new Error(`"${specifier}" escapes the project (imported from "${fromPath}")`);
			}
			segments.pop();
		} else {
			segments.push(part);
		}
	}
	const base = segments.join("/");
	for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
		if (byPath.has(candidate)) return candidate;
	}
	throw new Error(`Could not resolve "${specifier}" imported from "${fromPath}"`);
}

/**
 * Compile a multi-file lesson into ES modules executing in `realm`. Relative
 * imports between lesson files link through per-file blob modules; bare
 * `@implementjs/*` imports resolve to the playground's shimmed copies (or the
 * overrides in `extraModules`). Returns the module namespace of every entry.
 */
export async function importLessonProject(
	files: ProjectFile[],
	entries: string[],
	extraModules: Record<string, ShimModule> = {},
	realm: Window = window,
): Promise<{ modules: Map<string, Record<string, unknown>>; revoke: () => void }> {
	const shimModules: Record<string, ShimModule> = {
		[IMPLEMENT]: implement,
		[FORMISH]: formish,
		[LUCIDE]: lucide,
		[MODE_WATCHER]: modeWatcher,
		[PRIMITIVES]: primitives,
		[VALIBOT]: valibot,
		...extraModules,
	};
	for (const [specifier, moduleObject] of Object.entries(shimModules)) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shim modules are parked on the preview realm's globalThis.
		(realm as Window & ShimModule)[shimKey(specifier)] = moduleObject;
	}

	const byPath = new Map(files.map((file) => [file.path, file.content]));
	const urls = new Map<string, string>();
	const building = new Set<string>();
	const created: string[] = [];

	const urlFor = (path: string): string => {
		const cached = urls.get(path);
		if (cached != null) return cached;
		if (building.has(path)) {
			throw new Error(`Import cycle through "${path}" — break the cycle to run this app.`);
		}
		building.add(path);
		const source = byPath.get(path);
		if (source == null) throw new Error(`Missing file "${path}"`);
		const linked = rewriteImports(transpile(source), shimModules).replace(
			RELATIVE_IMPORT,
			(match, quote: string, specifier: string) =>
				match.replace(
					`${quote}${specifier}${quote}`,
					JSON.stringify(urlFor(resolveRelative(path, specifier, byPath))),
				),
		);
		building.delete(path);
		const url = URL.createObjectURL(new Blob([linked], { type: "text/javascript" }));
		urls.set(path, url);
		created.push(url);
		return url;
	};

	const revoke = () => {
		for (const url of created) URL.revokeObjectURL(url);
	};

	try {
		const modules = new Map<string, Record<string, unknown>>();
		for (const entry of entries) {
			modules.set(entry, await importInRealm(realm, urlFor(entry)));
		}
		return { modules, revoke };
	} catch (error) {
		revoke();
		throw error;
	}
}

export async function runLesson(
	code: string,
	target: HTMLElement,
	realm: Window = window,
): Promise<() => void> {
	const { mod, revoke } = await importLessonModule(code, {}, realm);
	try {
		const instance = mountExport(mod.default, target);
		return () => {
			instance.unmount();
			revoke();
		};
	} catch (error) {
		revoke();
		throw error;
	}
}
