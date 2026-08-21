import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Connect, Plugin, ViteDevServer } from "vite";

/** Where an app's html shell lives, preferred first. */
const SHELL_PATHS = ["src/index.html", "index.html"] as const;

/** The name Vite serves the root shell under, and the file the prerender reads. */
const ROOT_SHELL = "index.html";

/** A shell Vite already handles on its own — nothing about the config needs changing for it. */
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

const cleanUrl = (url: string): string => url.replace(/[?#].*$/, "");

/**
 * Serves `src/index.html` for navigations. Vite only ever reads `<root>/index.html`, so a shell
 * under `src/` needs its own middleware — registered from a `configureServer` post hook so it lands
 * after Vite's static and html-fallback middlewares (which have already rewritten the URL of every
 * navigation to `/index.html`) and before the 404.
 */
export function serveShell(server: ViteDevServer, shell: string): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (res.writableEnded) return next();
		if (req.method !== "GET" && req.method !== "HEAD") return next();
		if (req.url === undefined || cleanUrl(req.url) !== `/${ROOT_SHELL}`) return next();
		// an html file imported as a module, not a page
		if (req.headers["sec-fetch-dest"] === "script") return next();

		server
			.transformIndexHtml(`/${ROOT_SHELL}`, readFileSync(shell, "utf8"), req.originalUrl)
			.then((html) => {
				res.statusCode = 200;
				res.setHeader("Content-Type", "text/html");
				res.setHeader("Cache-Control", "no-cache");
				res.end(req.method === "HEAD" ? "" : html);
			}, next);
	};
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
