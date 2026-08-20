/**
 * Every demo's source text, keyed the way docs markdown places demos
 * (`accordion-demo.ts` → `accordion`). Glob-driven so it stays in step with
 * the {@link demos} registry without importing the demo components — the
 * `.md` server routes use this to swap `<div data-demo>` placeholders for
 * the demo's code without pulling component modules into a server render.
 */
const files = import.meta.glob<string>("./*-demo.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

export const demoSources: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, source]) => [path.slice(2).replace(/-demo\.ts$/, ""), source]),
);
