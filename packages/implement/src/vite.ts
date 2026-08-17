import path from "node:path";
import { normalizePath, type Plugin } from "vite";

// Appended to every entry module (the ones index.html loads). Vite's server
// decides HMR propagation by statically scanning module source for
// `import.meta.hot.accept(...)`, so this text has to live in the entry itself —
// a runtime accept() call inside the framework would still full-reload.
const HMR_GLUE = `
;import { disposeRoots as __implementDisposeRoots } from "@packages/implement/hmr";
if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => __implementDisposeRoots());
}
`;

/**
 * Wires an implement app into Vite's HMR. The modules referenced by
 * `index.html`'s `<script type="module">` tags self-accept updates: any edit in
 * the app's module graph bubbles up to the entry, which unmounts every mounted
 * `App` root and re-executes against the updated modules — patching the page in
 * place instead of triggering a full reload. Dev-only; `vite build` is untouched.
 */
export function implement(): Plugin {
	let root = "";
	const entries = new Set<string>();

	return {
		name: "implement",
		apply: "serve",
		configResolved(config) {
			root = config.root;
		},
		transformIndexHtml(html) {
			for (const [tag, src] of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/g)) {
				if (!/\btype\s*=\s*["']module["']/.test(tag)) continue;
				if (/^(?:[a-z]+:)?\/\//.test(src!)) continue;
				entries.add(normalizePath(path.resolve(root, src!.replace(/^\//, ""))));
			}
		},
		transform(code, id) {
			const [file] = id.split("?", 1);
			if (!entries.has(normalizePath(file!))) return;
			// Appending keeps line numbers intact, so the sourcemap stays valid.
			return { code: code + HMR_GLUE, map: null };
		},
	};
}
