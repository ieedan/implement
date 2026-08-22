import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createServer, type Plugin, type ResolvedConfig, type ViteDevServer } from "vite";
import { injectSsr, renderDocument } from "./inject.ts";
import { crawlRoutes, prerenderRoutes, type RenderFn, type TransformHtml } from "./prerender.ts";
import { collectDevStyles } from "./styles.ts";

export { injectSsr, renderDocument, type SsrResult } from "./inject.ts";
export {
	crawlRoutes,
	normalizeRoute,
	prerenderRoutes,
	type CrawlOptions,
	type RenderFn,
	type TransformHtml,
} from "./prerender.ts";
export { collectDevStyles, devStyleTags, type DevStyle } from "./styles.ts";

/** What a build-time hook gets to reach the app's modules with. */
export type BuildContext = {
	render: RenderFn;
	/** Load a module (real or virtual id) through the build-time SSR module runner. */
	load: (id: string) => Promise<Record<string, unknown>>;
};

export type PrerenderContext = BuildContext & {
	/** Every route that was prerendered. */
	routes: string[];
	/** Absolute path of the build output directory. */
	outDir: string;
};

/** What runs once the client build (and any prerender) is done. */
export type FinishContext = {
	/** Every route that was prerendered — empty when prerendering is off. */
	routes: string[];
	/** Absolute path of the build output directory. */
	outDir: string;
};

export type PrerenderOptions = {
	/**
	 * Routes to prerender. Defaults to crawling internal links from `/`.
	 * A function receives the build context so it can crawl for routes and
	 * consult the app's own modules about which of them to keep.
	 */
	routes?: string[] | ((context: BuildContext) => string[] | Promise<string[]>);
	/**
	 * A path matching no route, rendered into `404.html` so static hosts
	 * serve the app's not-found fallback for unknown URLs.
	 */
	notFound?: string;
	/**
	 * A final pass over each prerendered page (the `404.html` fallback
	 * included), after the server render is injected and before the file is
	 * written — for the per-route tags only the finished build can name.
	 */
	transformHtml?: TransformHtml;
	/**
	 * Runs after the routes are prerendered, with the SSR module runner still
	 * open — for writing extra files (endpoints, data payloads, sitemaps) into
	 * the output directory.
	 */
	after?: (context: PrerenderContext) => void | Promise<void>;
};

export type ImplementOptions = {
	/** Module exporting `render(url): { html, head }`. @default "/src/entry-server.ts" */
	entry?: string;
	/** Prerender the built site into the output directory. @default true */
	prerender?: boolean | PrerenderOptions;
	/**
	 * Runs once the client build is done and anything prerendered has been
	 * written — the hook a host hangs its own output stage off, whether or not
	 * prerendering is on. `@implementjs/kit` builds its server bundle and runs
	 * the app's adapter here.
	 */
	finish?: (context: FinishContext) => void | Promise<void>;
	/**
	 * Server-render dev pages by injecting the entry's render into the html
	 * shell as Vite transforms it. Turn this off when the host serves pages
	 * itself — `@implementjs/kit` does, so its request hooks see the real
	 * request — and the plugin is left doing only the build's prerender.
	 * @default true
	 */
	devSsr?: boolean;
};

/**
 * Tier-1 SSR for implement apps: serves every dev page server-rendered
 * (content paints before any JS loads) and prerenders the built site.
 * The app provides an entry module exporting `render(url)` (sync or async);
 * a `data` field on the result is embedded in the page as a JSON script tag
 * (`<script type="application/json" data-implement-data>`) for the client
 * runtime to pick up. Typically:
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
	const devSsr = options.devSsr ?? true;
	let config: ResolvedConfig;
	let server: ViteDevServer | undefined;

	return {
		name: "implement",
		/**
		 * The implement packages are never external to an SSR run. Published
		 * they are plain ESM, so Vite would hand them straight to Node, where
		 * the `import.meta.env` their dev-only diagnostics read does not exist
		 * and the first one to run throws. Bundling them puts the server halves
		 * on the same `import.meta.env` the client build gives them.
		 * `@implementjs/kit`'s own server build already does this.
		 */
		config() {
			return { ssr: { noExternal: [/^@implementjs\//] } };
		},
		configResolved(resolved) {
			config = resolved;
		},
		configureServer(s) {
			server = s;
		},
		transformIndexHtml: {
			order: "post",
			async handler(html, ctx) {
				if (!server || !devSsr) return html;
				try {
					// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SSR entry module exports the app render function.
					const { render } = (await server.ssrLoadModule(entry)) as { render: RenderFn };
					const result = await render(ctx.originalUrl ?? "/");
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
			if (config.command !== "build" || config.build.ssr) return;
			const outDir = isAbsolute(config.build.outDir)
				? config.build.outDir
				: join(config.root, config.build.outDir);
			const finish = options.finish;
			if (prerender === false) {
				await finish?.({ routes: [], outDir });
				return;
			}
			const template = readFileSync(join(outDir, "index.html"), "utf8");
			// the sources render through a dev-mode module runner; the built
			// client bundle has no render entry to import. It runs on the config
			// the build itself was given — plugins passed inline rather than
			// through a config file are still the app's plugins, and a prerender
			// that resolved modules differently from the build would be rendering
			// a different app
			const { build: _build, ...inline } = config.inlineConfig;
			const dev = await createServer({
				...inline,
				root: config.root,
				server: { middlewareMode: true },
				appType: "custom",
				logLevel: "error",
			});
			let routes: string[] = [];
			try {
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SSR entry module exports the app render function.
				const { render } = (await dev.ssrLoadModule(entry)) as { render: RenderFn };
				const load = (id: string) => dev.ssrLoadModule(id) as Promise<Record<string, unknown>>;
				const routesOption = typeof prerender === "object" ? prerender.routes : undefined;
				routes =
					routesOption == null
						? await crawlRoutes(render)
						: typeof routesOption === "function"
							? await routesOption({ render, load })
							: routesOption;
				const transformHtml = typeof prerender === "object" ? prerender.transformHtml : undefined;
				const { written, failed } = await prerenderRoutes({
					render,
					routes,
					template,
					outDir,
					transformHtml,
				});
				config.logger.info(`prerendered ${written}/${routes.length} routes`);
				if (failed.length > 0) {
					throw new Error(`prerender failed:\n  ${failed.join("\n  ")}`);
				}
				const notFound = typeof prerender === "object" ? prerender.notFound : undefined;
				if (notFound !== undefined) {
					writeFileSync(
						join(outDir, "404.html"),
						await renderDocument(
							template,
							await render(notFound),
							[],
							transformHtml === undefined ? undefined : (html) => transformHtml(notFound, html),
						),
					);
				}
				const after = typeof prerender === "object" ? prerender.after : undefined;
				await after?.({ routes, outDir, render, load });
			} finally {
				await dev.close();
			}
			// outside the module runner's lifetime: an adapter's own build runs
			// here, and nothing it does should keep a dev server open
			await finish?.({ routes, outDir });
		},
	};
}
