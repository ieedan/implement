/**
 * Every styled component's source text, keyed the way docs markdown places it
 * (`accordion.ts` → `accordion`). `<div data-source="accordion"></div>` on a UI
 * page renders this verbatim — the manual install *is* copying the file, so the
 * page shows the file itself rather than a transcription that can drift.
 *
 * Glob-driven, and read as text only: nothing here imports a component module,
 * so the `.md` server routes can resolve the same placeholder.
 */
const files = import.meta.glob<string>("./components/ui/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

const prefix = "./components/ui/";

export const uiSources: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, source]) => [
		path.slice(prefix.length).replace(/\.ts$/, ""),
		source,
	]),
);

/** Where a styled component's file belongs in a consuming project. */
export function uiSourcePath(name: string): string {
	return `src/lib/components/ui/${name}.ts`;
}
