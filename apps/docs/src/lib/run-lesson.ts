import * as implement from "@implementjs/core";
import { transform } from "sucrase";

const IMPLEMENT = "@implementjs/core";
const RUNTIME = "implementPlaygroundRuntime";

type ImplementRuntime = typeof implement;
type GlobalWithRuntime = typeof globalThis & {
	[RUNTIME]?: ImplementRuntime;
};

type Mounted = {
	mount: (parent: HTMLElement) => void;
	unmount: () => void;
};

let shimUrl: string | null = null;

function implementModuleUrl(): string {
	if (shimUrl != null) return shimUrl;
	const globalObject: GlobalWithRuntime = globalThis;
	globalObject[RUNTIME] = implement;
	const names = Object.keys(implement).filter((name) => name !== "default");
	const source = [
		`const m = globalThis[${JSON.stringify(RUNTIME)}];`,
		...names.map((name) => `export const ${name} = m[${JSON.stringify(name)}];`),
	].join("\n");
	shimUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
	return shimUrl;
}

function transpile(code: string): string {
	return transform(code, {
		transforms: ["typescript"],
		disableESTransforms: true,
		production: true,
	}).code;
}

function rewriteImplementImports(code: string): string {
	return code.replace(
		/from\s+["']@implementjs\/core["']/g,
		`from ${JSON.stringify(implementModuleUrl())}`,
	);
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

export async function runLesson(code: string, target: HTMLElement): Promise<() => void> {
	const rewritten = rewriteImplementImports(transpile(code));
	if (rewritten.includes(IMPLEMENT)) {
		throw new Error(`Could not resolve "${IMPLEMENT}". Import it with a string literal.`);
	}

	const url = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
	try {
		const mod: { default?: unknown } = await import(/* @vite-ignore */ url);
		const instance = mountExport(mod.default, target);
		return () => {
			instance.unmount();
			URL.revokeObjectURL(url);
		};
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}
}
