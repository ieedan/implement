import { basename, join, sep } from "node:path";
import {
	crawlRoutes,
	implement,
	normalizeRoute,
	type RenderFn,
	type PrerenderOptions,
} from "@implementjs/vite";
import type { Plugin } from "vite";
import { generateRouterModule, staticRoutePaths } from "./codegen.ts";
import { isRouteFileName, scanRoutes, type RouteTree } from "./scan.ts";
import { IMPLEMENT_DIR, writeGenerated } from "./typegen.ts";

export type { PageRoute } from "./codegen.ts";
export type { RouteTree } from "./scan.ts";
export { sync } from "./sync.ts";

const ROUTER_ID = "$implement/router";
const RESOLVED_ROUTER_ID = "\0$implement/router";
/** Deliberately unmatched, so the fallback renders for the 404 page. */
const NOT_FOUND_ROUTE = "/__implement__/not-found";

export type KitPrerenderOptions = {
	/**
	 * Routes to prerender beyond the statically known pages and the internal
	 * link crawl — fill in dynamic `[param]` routes here.
	 */
	entries?: string[] | (() => string[] | Promise<string[]>);
};

export type KitOptions = {
	/** Routes directory relative to the Vite root. @default "src/routes" */
	routes?: string;
	/** Prerender the built site. @default true */
	prerender?: boolean | KitPrerenderOptions;
};

/**
 * File-based routing for implement apps. Scans `src/routes` — `index.ts` is a
 * page, `layout.ts` wraps everything beneath it, `[param]` and `[...rest]`
 * directories bind params, `(group)` directories scope a layout without
 * adding a URL segment, `index@<segment>.ts` / `layout@<segment>.ts` reset
 * the layout chain to an ancestor segment (`index@.ts` resets to the root),
 * and a root `error.ts` renders unmatched paths and render errors —
 * and serves the app through `@implementjs/vite`'s SSR dev server and
 * prerenderer. The router itself is exposed as the `$implement/router`
 * virtual module; generated entries, `./$types` declarations, and the
 * tsconfig apps extend land in `.implement/`.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * export default defineConfig({ plugins: [kit()] });
 * ```
 *
 * The app's `index.html` loads the generated client entry:
 *
 * ```html
 * <script type="module" src="/.implement/entry-client.ts"></script>
 * ```
 */
export function kit(options: KitOptions = {}): Plugin[] {
	const routes = options.routes ?? "src/routes";
	const routesBase = `/${routes.replaceAll("\\", "/")}`;
	let root = process.cwd();
	let routesDir = join(root, routes);
	let tree: RouteTree | null = null;

	const scan = (): RouteTree => {
		tree = scanRoutes(routesDir);
		return tree;
	};

	const entriesOption =
		typeof options.prerender === "object" ? options.prerender.entries : undefined;
	// notFound is filled in from the scan in configResolved, before closeBundle reads it
	const prerenderConfig: PrerenderOptions = {
		routes: async (render: RenderFn) => {
			const entries =
				typeof entriesOption === "function" ? await entriesOption() : (entriesOption ?? []);
			const all = new Set([
				...staticRoutePaths(tree ?? scan()).map(normalizeRoute),
				...entries.map(normalizeRoute),
				...crawlRoutes(render),
			]);
			return [...all];
		},
	};

	const kitPlugin: Plugin = {
		name: "implement-kit",
		configResolved(config) {
			root = config.root;
			routesDir = join(root, routes);
			const scanned = scan();
			writeGenerated(root, scanned, { routes });
			if (scanned.error !== null) prerenderConfig.notFound = NOT_FOUND_ROUTE;
		},
		resolveId(id) {
			if (id === ROUTER_ID) return RESOLVED_ROUTER_ID;
			return null;
		},
		load(id) {
			if (id === RESOLVED_ROUTER_ID) {
				return generateRouterModule(tree ?? scan(), routesBase);
			}
			return null;
		},
		configureServer(server) {
			const isRouteFile = (file: string) =>
				file.startsWith(routesDir + sep) && isRouteFileName(basename(file));
			const regenerate = () => {
				try {
					writeGenerated(root, scan(), { routes });
				} catch (error) {
					server.config.logger.error(
						`route scan failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}
				const mod = server.moduleGraph.getModuleById(RESOLVED_ROUTER_ID);
				if (mod) server.moduleGraph.invalidateModule(mod);
				server.ws.send({ type: "full-reload" });
			};
			const onFile = (file: string) => {
				if (isRouteFile(file)) regenerate();
			};
			const onDir = (dir: string) => {
				if (dir.startsWith(routesDir + sep)) regenerate();
			};
			server.watcher.on("add", onFile);
			server.watcher.on("unlink", onFile);
			server.watcher.on("unlinkDir", onDir);
		},
	};

	return [
		kitPlugin,
		implement({
			entry: `/${IMPLEMENT_DIR}/entry-server.ts`,
			prerender: options.prerender === false ? false : prerenderConfig,
		}),
	];
}
