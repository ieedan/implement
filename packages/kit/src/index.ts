import { basename, join, resolve, sep } from "node:path";
import {
	crawlRoutes,
	implement,
	normalizeRoute,
	type RenderFn,
	type PrerenderOptions,
} from "@implementjs/vite";
import type { Plugin } from "vite";
import {
	generateEndpointsModule,
	generateLoadsModule,
	generateRouterModule,
	serverRoutes,
	staticRoutePaths,
} from "./codegen.ts";
import { ENDPOINTS_ID, handleServerRequest, LOADS_ID, prerenderServerFiles } from "./dev.ts";
import { isRouteFileName, scanRoutes, type RouteNode, type RouteTree } from "./scan.ts";
import { DEFAULT_ALIASES, IMPLEMENT_DIR, writeGenerated } from "./typegen.ts";

export type { DataChain, PageRoute, ServerRoute } from "./codegen.ts";
export type { ExtensionEndpoint, RouteTree } from "./scan.ts";
export { sync } from "./sync.ts";

const ROUTER_ID = "$implement/router";
const RESOLVED_ROUTER_ID = "\0$implement/router";
const RESOLVED_LOADS_ID = `\0${LOADS_ID}`;
const RESOLVED_ENDPOINTS_ID = `\0${ENDPOINTS_ID}`;
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
	/**
	 * Extra import aliases, mapped to paths relative to the Vite root. Each
	 * entry is wired into both Vite's `resolve.alias` and the generated
	 * tsconfig's `paths`, on top of the automatic `@/lib` → `src/lib`.
	 *
	 * ```ts
	 * kit({ alias: { "@/content": "src/content" } });
	 * ```
	 */
	alias?: Record<string, string>;
};

const treeHasLoads = (node: RouteNode): boolean =>
	node.pageServer !== null || node.layoutServer !== null || node.children.some(treeHasLoads);

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
 * Server files run only on the server (dev requests and the prerender):
 * `index.server.ts` / `layout.server.ts` export a load function whose result
 * reaches the page or layout as its `data` readable — serialized into the
 * prerendered page, and fetched from `__data.json` on client navigation.
 * A `server.ts` exports request handlers (`GET`, `POST`, …) serving its
 * directory's path; inside a `.<ext>` directory it serves the parent path
 * with the extension appended (`docs/.md/server.ts` → `/docs.md`), and GET
 * endpoints are prerendered into static files.
 *
 * Kit also sets up the app conventions: static assets in `static/` are
 * served at the site root and copied into the build (unless the app sets
 * its own Vite `publicDir`), and `@/lib` resolves to `src/lib` — in Vite
 * and, through the generated tsconfig, in TypeScript. The `alias` option
 * adds more aliases wired up the same way.
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
	const aliases = { ...DEFAULT_ALIASES, ...options.alias };
	const genOptions = { routes, alias: options.alias };
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
				...(await crawlRoutes(render)),
			]);
			return [...all];
		},
		after: async ({ routes: prerendered, outDir, load }) => {
			const scanned = tree ?? scan();
			await prerenderServerFiles({
				routes: prerendered,
				outDir,
				load,
				hasLoads: treeHasLoads(scanned.root),
				serverRoutes: serverRoutes(scanned),
				logger: console,
			});
		},
	};

	const kitPlugin: Plugin = {
		name: "implement-kit",
		config(userConfig) {
			const appRoot = resolve(userConfig.root ?? ".");
			const alias = Object.fromEntries(
				Object.entries(aliases).map(([name, target]) => [name, resolve(appRoot, target)]),
			);
			return {
				publicDir: userConfig.publicDir ?? "static",
				resolve: { alias },
			};
		},
		configResolved(config) {
			root = config.root;
			routesDir = join(root, routes);
			const scanned = scan();
			writeGenerated(root, scanned, genOptions);
			if (scanned.error !== null) prerenderConfig.notFound = NOT_FOUND_ROUTE;
		},
		resolveId(id) {
			if (id === ROUTER_ID) return RESOLVED_ROUTER_ID;
			if (id === LOADS_ID) return RESOLVED_LOADS_ID;
			if (id === ENDPOINTS_ID) return RESOLVED_ENDPOINTS_ID;
			return null;
		},
		load(id, loadOptions) {
			if (id === RESOLVED_ROUTER_ID) {
				return generateRouterModule(tree ?? scan(), routesBase);
			}
			if (id === RESOLVED_LOADS_ID || id === RESOLVED_ENDPOINTS_ID) {
				// server files must never reach the browser bundle
				if (loadOptions?.ssr !== true) {
					throw new Error(`${id.slice(1)} is server-only and cannot be imported by client code`);
				}
				return id === RESOLVED_LOADS_ID
					? generateLoadsModule(tree ?? scan(), routesBase)
					: generateEndpointsModule(tree ?? scan(), routesBase);
			}
			return null;
		},
		configureServer(server) {
			const isRouteFile = (file: string) =>
				file.startsWith(routesDir + sep) && isRouteFileName(basename(file));
			const regenerate = () => {
				try {
					writeGenerated(root, scan(), genOptions);
				} catch (error) {
					server.config.logger.error(
						`route scan failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}
				for (const id of [RESOLVED_ROUTER_ID, RESOLVED_LOADS_ID, RESOLVED_ENDPOINTS_ID]) {
					const mod = server.moduleGraph.getModuleById(id);
					if (mod) server.moduleGraph.invalidateModule(mod);
				}
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

			server.middlewares.use((req, res, next) => {
				const scanned = tree ?? scan();
				handleServerRequest({
					server,
					req,
					res,
					hasLoads: treeHasLoads(scanned.root),
					hasEndpoints: serverRoutes(scanned).length > 0,
				}).then((handled) => {
					if (!handled) next();
				}, next);
			});
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
