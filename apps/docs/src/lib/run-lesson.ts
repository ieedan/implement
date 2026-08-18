import * as implement from "@implementjs/core";
import { transform } from "sucrase";

const IMPLEMENT = "@implementjs/core";

export type ShimModule = Record<string, unknown>;

type Mounted = {
	mount: (parent: HTMLElement) => void;
	unmount: () => void;
};

const shimUrls = new Map<string, string>();

// Bare specifiers can't resolve from a blob module, so each shimmed module is
// parked on globalThis and re-exported from a generated blob the imports are
// rewritten to point at.
function moduleShimUrl(specifier: string, moduleObject: ShimModule): string {
	const cached = shimUrls.get(specifier);
	if (cached != null) return cached;
	const key = `implementPlaygroundRuntime:${specifier}`;
	(globalThis as typeof globalThis & ShimModule)[key] = moduleObject;
	const names = Object.keys(moduleObject).filter((name) => name !== "default");
	const source = [
		`const m = globalThis[${JSON.stringify(key)}];`,
		...names.map((name) => `export const ${name} = m[${JSON.stringify(name)}];`),
	].join("\n");
	const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
	shimUrls.set(specifier, url);
	return url;
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
		if (rewritten.includes(specifier)) {
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
): Promise<{ mod: Record<string, unknown>; revoke: () => void }> {
	const rewritten = rewriteImports(transpile(code), {
		[IMPLEMENT]: implement as unknown as ShimModule,
		...extraModules,
	});

	const url = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
	try {
		const mod: Record<string, unknown> = await import(/* @vite-ignore */ url);
		return { mod, revoke: () => URL.revokeObjectURL(url) };
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}
}

export async function runLesson(code: string, target: HTMLElement): Promise<() => void> {
	const { mod, revoke } = await importLessonModule(code);
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
