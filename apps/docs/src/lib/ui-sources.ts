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

const componentPrefix = "./components/ui/";

export const uiSources: Record<string, string> = Object.fromEntries(
	Object.entries(componentFiles).map(([path, source]) => [
		path.slice(componentPrefix.length).replace(/\.ts$/, ""),
		source,
	]),
);

/** Where a registry file belongs in a consuming project, which is what its page tells you to copy it to. */
export function uiSourcePath(name: string): string {
	return `src/lib/components/ui/${name}.ts`;
}
