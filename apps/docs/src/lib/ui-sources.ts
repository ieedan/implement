/**
 * Every registry file's source text, keyed the way docs markdown places it
 * (`accordion.ts` → `accordion`). `<div data-source="accordion"></div>` on a UI
 * page renders this verbatim — the manual install *is* copying the file, so the
 * page shows the file itself rather than a transcription that can drift.
 *
 * Glob-driven, and read as text only: nothing here imports a component module,
 * so the `.md` server routes can resolve the same placeholder.
 */
const componentFiles = import.meta.glob<string>("./components/ui/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

/**
 * `cn` ships from the registry too, but as a `lib` item rather than a `ui` one —
 * it lands beside a project's own helpers instead of among the components.
 */
const libFiles = import.meta.glob<string>("./utils.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

const componentPrefix = "./components/ui/";
const libPrefix = "./";

function keyed(files: Record<string, string>, prefix: string): [string, string][] {
	return Object.entries(files).map(([path, source]) => [
		path.slice(prefix.length).replace(/\.ts$/, ""),
		source,
	]);
}

export const uiSources: Record<string, string> = Object.fromEntries([
	...keyed(componentFiles, componentPrefix),
	...keyed(libFiles, libPrefix),
]);

/** The `lib` items, by name — everything else in the registry is a component. */
const LIB_ITEMS = new Set(Object.keys(Object.fromEntries(keyed(libFiles, libPrefix))));

/** Where a registry file belongs in a consuming project, which is what its page tells you to copy it to. */
export function uiSourcePath(name: string): string {
	return LIB_ITEMS.has(name) ? `src/lib/${name}.ts` : `src/lib/components/ui/${name}.ts`;
}
