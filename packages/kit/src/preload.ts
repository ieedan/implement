import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TransformHtml } from "@implementjs/vite";
import { routeModuleId, routeModules } from "./codegen.ts";
import { comparePatterns, matchRoutePattern, normalizeRoutePath } from "./match.ts";
import type { RouteTree } from "./scan.ts";

/**
 * The entries of Vite's build manifest this needs: where a module ended up,
 * what that chunk statically imports, and any CSS extracted alongside it.
 */
type ManifestChunk = {
	file: string;
	imports?: string[];
	css?: string[];
};

type ViteManifest = Record<string, ManifestChunk>;

/** The files a route's render pulls in, deduplicated, in visit order. */
type RouteAssets = { modules: string[]; styles: string[] };

/**
 * Per-route preload hints for the prerendered pages.
 *
 * Splitting by route without these is a regression on first load: the browser
 * parses the entry chunk, discovers the dynamic import, and only *then* starts
 * fetching the route's own chunk — a round trip that the single-bundle build
 * did not pay. A `<link rel="modulepreload">` per chunk moves that fetch back
 * to markup-parse time, so the route's code arrives alongside the entry
 * instead of after it, and any stylesheet the split scoped to the route is
 * linked the same way.
 *
 * Only the build manifest knows what the chunks are called, and it exists only
 * once the client build has written it — hence the lazy read. The prerender
 * runs from `closeBundle`, by which point the file is there.
 */
export function preloadHints(options: {
	/** Absolute path of Vite's build manifest, or `null` when it is turned off. */
	manifest: string | null;
	/** Route directory relative to the Vite root, leading slash included. */
	routesBase: string;
	/** The scanned tree, read on first use so the prerender sees the latest scan. */
	tree: () => RouteTree;
}): TransformHtml {
	let manifest: ViteManifest | null | undefined;
	let routes: { pattern: string; modules: string[] }[] | undefined;

	return (route, html) => {
		if (manifest === undefined) manifest = readManifest(options.manifest);
		// no manifest means no chunk names; the page still works, it just pays
		// the extra round trip
		if (manifest === null) return html;
		routes ??= routeModules(options.tree())
			.map((entry) => ({
				pattern: entry.pattern,
				modules: entry.files.map((file) => routeModuleId(options.routesBase, file)),
			}))
			// most specific first, matching how the runtime resolves a path
			.sort((a, b) => comparePatterns(a.pattern, b.pattern));

		const path = normalizeRoutePath(route);
		const match = routes.find((entry) => matchRoutePattern(entry.pattern, path) !== null);
		// the 404 fallback deliberately matches nothing, and renders the error
		// page, which is in the entry chunk already
		if (match === undefined) return html;
		return inject(html, collectAssets(manifest, match.modules));
	};
}

function readManifest(path: string | null): ViteManifest | null {
	if (path === null || !existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf8")) as ViteManifest;
}

/** Where Vite writes the build manifest for a resolved `build.manifest` setting. */
export function manifestPath(outDir: string, manifest: string | boolean): string | null {
	if (manifest === false) return null;
	return join(outDir, manifest === true ? join(".vite", "manifest.json") : manifest);
}

/**
 * A route's chunks, closed over the static imports each one pulls in — a
 * modulepreload for a chunk alone would still leave the browser discovering
 * that chunk's own dependencies only after it parses.
 */
function collectAssets(manifest: ViteManifest, ids: string[]): RouteAssets {
	const modules: string[] = [];
	const styles: string[] = [];
	const seen = new Set<string>();
	const visit = (key: string) => {
		if (seen.has(key)) return;
		seen.add(key);
		const chunk = manifest[key];
		// a module Rollup folded into another chunk has no entry of its own —
		// whatever absorbed it is reached through the importer that did
		if (chunk === undefined) return;
		modules.push(chunk.file);
		styles.push(...(chunk.css ?? []));
		for (const imported of chunk.imports ?? []) visit(imported);
	};
	for (const id of ids) visit(id);
	return { modules: [...new Set(modules)], styles: [...new Set(styles)] };
}

/**
 * `crossorigin` mirrors what Vite puts on its own script and preload tags: a
 * module script is fetched in CORS mode either way, and a preload that does
 * not match the eventual request is a download the browser throws away.
 */
function inject(html: string, assets: RouteAssets): string {
	// the shell already links the entry chunk and everything it statically
	// imports — hashed filenames are unique enough to spot those by
	const fresh = (file: string): boolean => !html.includes(file);
	const tags = [
		...assets.modules
			.filter(fresh)
			.map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`),
		...assets.styles
			.filter(fresh)
			.map((file) => `<link rel="stylesheet" crossorigin href="/${file}">`),
	];
	if (tags.length === 0) return html;
	return html.replace("</head>", `${tags.join("\n\t\t")}\n\t</head>`);
}
