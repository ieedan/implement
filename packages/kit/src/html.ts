import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import type { Connect, Plugin } from "vite";

/** Where an app's html shell lives, preferred first. */
const SHELL_PATHS = ["src/index.html", "index.html"] as const;

/** The name the build output uses for the shell, and the file the prerender reads. */
const ROOT_SHELL = "index.html";

/** What the prerender writes the app's error page to, and static hosts serve for unknown paths. */
const NOT_FOUND_SHELL = "404.html";

/** A shell already at Vite's own entry — nothing about the build config needs changing for it. */
export const isRootShell = (relative: string): boolean => relative === ROOT_SHELL;

/**
 * Resolves the app's html shell relative to the Vite root. `src/index.html` keeps the shell with
 * the rest of the app's source; a root `index.html` is the Vite default and still works.
 */
export function resolveShell(root: string): { path: string; relative: string } | null {
	for (const relative of SHELL_PATHS) {
		const path = join(root, relative);
		if (existsSync(path)) return { path, relative };
	}
	return null;
}

/**
 * Serves the prerendered pages in `vite preview`. Kit turns Vite's SPA fallback off — it answers
 * page requests itself in dev — which also takes Vite's `/path` → `/path/index.html` resolution
 * with it, so preview needs both halves here: the page for a path that has one, and the prerendered
 * `404.html` for a path that doesn't. Together that is what a static host does with the build.
 */
export function previewPages(outDir: string): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (res.writableEnded) return next();
		if (req.method !== "GET" && req.method !== "HEAD") return next();
		if (!(req.headers.accept ?? "").includes("text/html")) return next();

		const path = decodeURIPath(req.url ?? "/");
		if (path === null) return next();
		const page = join(outDir, path, ROOT_SHELL);
		// a decoded path may still climb out of the output directory
		const found = page.startsWith(outDir + sep) && existsSync(page);
		const file = found ? page : join(outDir, NOT_FOUND_SHELL);
		if (!found && !existsSync(file)) return next();

		res.statusCode = found ? 200 : 404;
		res.setHeader("Content-Type", "text/html");
		res.end(req.method === "HEAD" ? "" : readFileSync(file, "utf8"));
	};
}

/** The pathname of a request url, decoded, or `null` when it is not decodable. */
function decodeURIPath(url: string): string | null {
	try {
		return decodeURI(new URL(url, "http://preview.local").pathname);
	} catch {
		return null;
	}
}

/**
 * Vite names an html output after its path from the root, so a shell under `src/` would build to
 * `dist/src/index.html`. This moves it back to the root of the output — where a static host looks
 * for it, and where the prerender picks it up as the template. Enforced post so it runs after
 * Vite's own html plugin has emitted the asset.
 */
export function shellOutputPlugin(): Plugin {
	let relative = ROOT_SHELL;

	return {
		name: "implement-kit:html-output",
		enforce: "post",
		apply: "build",
		configResolved(config) {
			relative = resolveShell(config.root)?.relative ?? ROOT_SHELL;
		},
		generateBundle(_options, bundle) {
			if (isRootShell(relative)) return;
			const emitted = bundle[relative];
			if (emitted === undefined) return;
			delete bundle[relative];
			emitted.fileName = ROOT_SHELL;
			bundle[ROOT_SHELL] = emitted;
		},
	};
}
