import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createServer, type Plugin, type ResolvedConfig, type ViteDevServer } from "vite";
import { injectSsr } from "./inject.ts";
import { crawlRoutes, prerenderRoutes, type RenderFn } from "./prerender.ts";
import { collectDevStyles } from "./styles.ts";

export { injectSsr, type SsrResult } from "./inject.ts";
export { crawlRoutes, normalizeRoute, prerenderRoutes, type RenderFn } from "./prerender.ts";
export { collectDevStyles, devStyleTags, type DevStyle } from "./styles.ts";

export type PrerenderOptions = {
	/**
	 * Routes to prerender. Defaults to crawling internal links from `/`.
	 * A function receives the render so it can crawl and add to the result.
	 */
	routes?: string[] | ((render: RenderFn) => string[] | Promise<string[]>);
	/**
	 * A path matching no route, rendered into `404.html` so static hosts
	 * serve the app's not-found fallback for unknown URLs.
	 */
	notFound?: string;
};

export type ImplementOptions = {
	/** Module exporting `render(url): { html, head }`. @default "/src/entry-server.ts" */
	entry?: string;
	/** Prerender the built site into the output directory. @default true */
	prerender?: boolean | PrerenderOptions;
};

/**
 * Tier-1 SSR for implement apps: serves every dev page server-rendered
 * (content paints before any JS loads) and prerenders the built site.
 * The app provides an entry module exporting `render(url)`, typically:
 *
 * ```ts
 * // src/entry-server.ts
 * import { renderToString } from "@implementjs/core/server";
 * import { router } from "./router";
 * export const render = (url: string) => renderToString(router, { location: url });
 * ```
 *
 * `App.render` on the client swaps the server markup for its own mount.
 */
export function implement(options: ImplementOptions = {}): Plugin {
	const entry = options.entry ?? "/src/entry-server.ts";
	const prerender = options.prerender ?? true;
	let config: ResolvedConfig;
	let server: ViteDevServer | undefined;

	return {
		name: "implement",
		configResolved(resolved) {
			config = resolved;
		},
		configureServer(s) {
			server = s;
		},
		transformIndexHtml: {
			order: "post",
			async handler(html, ctx) {
				if (!server) return html;
				try {
					const { render } = (await server.ssrLoadModule(entry)) as { render: RenderFn };
					const result = render(ctx.originalUrl ?? "/");
					// inline the graph's CSS so SSR markup paints styled — dev CSS
					// otherwise arrives through JS modules, after first paint.
					// Builds don't need this: the extracted CSS link already blocks.
					return injectSsr(html, result, await collectDevStyles(server, entry));
				} catch (error) {
					server.config.logger.error(
						`ssr render failed for ${ctx.originalUrl}: ${error instanceof Error ? error.message : String(error)}`,
					);
					return html;
				}
			},
		},
		async closeBundle() {
			if (config.command !== "build" || config.build.ssr || prerender === false) return;
			const outDir = isAbsolute(config.build.outDir)
				? config.build.outDir
				: join(config.root, config.build.outDir);
			const template = readFileSync(join(outDir, "index.html"), "utf8");
			// the sources render through a dev-mode module runner; the built
			// client bundle has no render entry to import
			const dev = await createServer({
				root: config.root,
				server: { middlewareMode: true },
				appType: "custom",
				logLevel: "error",
			});
			try {
				const { render } = (await dev.ssrLoadModule(entry)) as { render: RenderFn };
				const routesOption = typeof prerender === "object" ? prerender.routes : undefined;
				const routes =
					routesOption == null
						? crawlRoutes(render)
						: typeof routesOption === "function"
							? await routesOption(render)
							: routesOption;
				const { written, failed } = prerenderRoutes({ render, routes, template, outDir });
				config.logger.info(`prerendered ${written}/${routes.length} routes`);
				if (failed.length > 0) {
					throw new Error(`prerender failed:\n  ${failed.join("\n  ")}`);
				}
				const notFound = typeof prerender === "object" ? prerender.notFound : undefined;
				if (notFound !== undefined) {
					writeFileSync(join(outDir, "404.html"), injectSsr(template, render(notFound)));
				}
			} finally {
				await dev.close();
			}
		},
	};
}
