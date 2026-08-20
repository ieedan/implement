import type { ModuleNode, ViteDevServer } from "vite";

/** A stylesheet pulled from the dev module graph, keyed by its Vite module id. */
export type DevStyle = { id: string; content: string };

/** Mirrors Vite's CSS_LANGS_RE. */
const STYLE_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
/** Sub-requests that don't inject styles on the client — not ours to inline. */
const SKIP_QUERY_RE = /[?&](?:raw|url|inline|direct)\b/;

/**
 * Collects the compiled CSS imported (transitively) by `entry` in the dev
 * server's module graph. Dev CSS normally arrives through JS modules, after
 * first paint — inlining these lets server-rendered markup paint styled.
 * Call after `ssrLoadModule(entry)` so the graph is populated.
 */
export async function collectDevStyles(
	server: ViteDevServer,
	entry: string,
): Promise<DevStyle[]> {
	const entryModule = await server.moduleGraph.getModuleByUrl(entry, true);
	if (!entryModule) return [];
	const seen = new Set<ModuleNode>();
	const styles: DevStyle[] = [];
	const queue: ModuleNode[] = [entryModule];
	while (queue.length > 0) {
		const mod = queue.shift()!;
		if (seen.has(mod)) continue;
		seen.add(mod);
		for (const dep of mod.importedModules) queue.push(dep);
		const id = mod.id;
		if (id === null || !STYLE_RE.test(id) || SKIP_QUERY_RE.test(id)) continue;
		// ?direct runs the css pipeline but returns plain CSS instead of the
		// style-injecting JS module — the same response a <link> gets in dev
		const direct = mod.url.includes("?") ? `${mod.url}&direct` : `${mod.url}?direct`;
		const result = await server.transformRequest(direct);
		if (result) styles.push({ id, content: result.code });
	}
	return styles;
}

/**
 * `<style>` tags for the head. `data-vite-dev-id` matches the id Vite's
 * client uses when injecting this module's styles, so the runtime adopts
 * these tags for HMR updates instead of appending duplicates.
 */
export function devStyleTags(styles: DevStyle[]): string {
	return styles
		.map(
			({ id, content }) =>
				`<style type="text/css" data-vite-dev-id="${escapeAttribute(id)}">${content.replaceAll("</style", "<\\/style")}</style>`,
		)
		.join("\n\t\t");
}

function escapeAttribute(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
