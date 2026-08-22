import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TransformHtml } from "@implementjs/vite";
import {
	collectAssets,
	injectAssetTags,
	matchRouteAssets,
	sortRouteAssets,
	type RouteAssetEntry,
	type ViteManifest,
} from "./assets.ts";
import { routeModuleId, routeModules } from "./codegen.ts";
import type { RouteTree } from "./scan.ts";

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
	/** Vite's `base`, which the emitted hrefs are relative to. @default "/" */
	base?: string;
}): TransformHtml {
	let entries: RouteAssetEntry[] | null | undefined;

	return (route, html) => {
		if (entries === undefined) {
			entries = routeAssets({
				manifest: readManifest(options.manifest),
				routesBase: options.routesBase,
				tree: options.tree(),
			});
		}
		// no manifest means no chunk names; the page still works, it just pays
		// the extra round trip
		if (entries === null) return html;
		const assets = matchRouteAssets(entries, route);
		if (assets === undefined) return html;
		return injectAssetTags(html, assets, options.base ?? "/");
	};
}

/**
 * Every page pattern with the chunks its render needs, most specific first —
 * what the prerender injects per page, and what a deployed server carries in
 * its manifest to inject per request. `null` when the build wrote no manifest.
 */
export function routeAssets(options: {
	manifest: ViteManifest | null;
	routesBase: string;
	tree: RouteTree;
}): RouteAssetEntry[] | null {
	const { manifest, routesBase, tree } = options;
	if (manifest === null) return null;
	return sortRouteAssets(
		routeModules(tree).map((entry) => ({
			pattern: entry.pattern,
			...collectAssets(
				manifest,
				entry.files.map((file) => routeModuleId(routesBase, file)),
			),
		})),
	);
}

export function readManifest(path: string | null): ViteManifest | null {
	if (path === null || !existsSync(path)) return null;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Vite writes the build manifest in this shape.
	return JSON.parse(readFileSync(path, "utf8")) as ViteManifest;
}

/** Where Vite writes the build manifest for a resolved `build.manifest` setting. */
export function manifestPath(outDir: string, manifest: string | boolean): string | null {
	if (manifest === false) return null;
	return join(outDir, manifest === true ? join(".vite", "manifest.json") : manifest);
}
