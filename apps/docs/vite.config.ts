import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vercel from "@implementjs/adapter-vercel";
import { kit } from "@implementjs/kit";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { velite } from "./plugins/velite";

const veliteDir = resolve(import.meta.dirname, ".velite");

/**
 * Dynamic `[...slug]` routes, straight from the Velite collections. Called only
 * when prerendering, so this is also where a docs collection missing its
 * `index.md` fails the build — at runtime that is a warning and a placeholder
 * (see `src/lib/content-error.ts`), because agents and editors leave content
 * trees half-written all the time and one gap must not take the dev site down.
 */
function entries(): string[] {
	const collect = (file: string, indexLabel?: string): string[] => {
		const pages: { permalink: string; slug: string }[] = JSON.parse(
			readFileSync(resolve(veliteDir, file), "utf8"),
		);
		if (indexLabel != null && !pages.some((page) => page.slug === "")) {
			throw new Error(`An index.md is required for the ${indexLabel} docs route`);
		}
		return pages.map((page) => page.permalink);
	};
	return [
		...collect("pages.json", "Docs"),
		...collect("primitives.json", "Primitives"),
		...collect("ui.json", "UI"),
		...collect("lucide.json", "Lucide"),
		...collect("kit.json", "Kit"),
		...collect("create.json", "Create"),
		...collect("eslint.json", "ESLint"),
		...collect("tutorials.json"),
	];
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		velite(),
		kit({
			// The docs are a Vercel deployment: the CDN serves everything the
			// prerender wrote, and the function behind it answers whatever is
			// left — an unknown path, and `hooks.server.ts` on the way past.
			adapter: vercel(),
			// A server adapter would otherwise default to `"auto"`, which leaves
			// every page with a server load to render per request. `/packages`
			// reads the workspace manifests off disk, and only the function's own
			// directory is uploaded — so the docs stay fully prerendered.
			prerender: { entries, default: true },
			alias: { "@": "src", "@tutorial/test": "src/lib/tutorial-test.ts" },
		}),
	],
	server: { port: 3004, strictPort: true },
});
