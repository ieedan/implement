/**
 * The build-manifest half of kit's per-route preload hints, with no `node:*`
 * in it — the prerenderer reads the manifest off disk and calls this
 * (`./preload.ts`), and a deployed server carries the resolved lists in its
 * own manifest and calls the same injector per request (`./handler.ts`).
 */

import { comparePatterns, matchRoutePattern, normalizeRoutePath } from "./match.ts";

/**
 * The entries of Vite's build manifest this needs: where a module ended up,
 * what that chunk statically imports, and any CSS extracted alongside it.
 */
export type ManifestChunk = {
	file: string;
	imports?: string[];
	css?: string[];
};

export type ViteManifest = Record<string, ManifestChunk>;

/** The files a route's render pulls in, deduplicated, in visit order. */
export type RouteAssets = { modules: string[]; styles: string[] };

/** A route pattern with the assets its render needs, ready to inject. */
export type RouteAssetEntry = RouteAssets & { pattern: string };

/**
 * A route's chunks, closed over the static imports each one pulls in — a
 * modulepreload for a chunk alone would still leave the browser discovering
 * that chunk's own dependencies only after it parses.
 */
export function collectAssets(manifest: ViteManifest, ids: string[]): RouteAssets {
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

/** Sorts route asset entries most specific first, matching how the runtime resolves a path. */
export function sortRouteAssets(entries: RouteAssetEntry[]): RouteAssetEntry[] {
	return entries.toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
}

/**
 * The assets for the route a path resolves to, or `null` when nothing matches
 * — the 404 fallback deliberately matches no route, and renders the error
 * page, which is in the entry chunk already.
 */
export function matchRouteAssets(
	entries: RouteAssetEntry[],
	path: string,
): RouteAssets | undefined {
	const normalized = normalizeRoutePath(path);
	return entries.find((entry) => matchRoutePattern(entry.pattern, normalized) !== null);
}

/**
 * `crossorigin` mirrors what Vite puts on its own script and preload tags: a
 * module script is fetched in CORS mode either way, and a preload that does
 * not match the eventual request is a download the browser throws away.
 */
export function injectAssetTags(html: string, assets: RouteAssets, base = "/"): string {
	// the shell already links the entry chunk and everything it statically
	// imports — hashed filenames are unique enough to spot those by
	const fresh = (file: string): boolean => !html.includes(file);
	const href = (file: string): string => `${base.endsWith("/") ? base : `${base}/`}${file}`;
	const tags = [
		...assets.modules
			.filter(fresh)
			.map((file) => `<link rel="modulepreload" crossorigin href="${href(file)}">`),
		...assets.styles
			.filter(fresh)
			.map((file) => `<link rel="stylesheet" crossorigin href="${href(file)}">`),
	];
	if (tags.length === 0) return html;
	return html.replace("</head>", `${tags.join("\n\t\t")}\n\t</head>`);
}
