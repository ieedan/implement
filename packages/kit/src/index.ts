import { existsSync } from "node:fs";
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
	generateHooksModule,
	generatePagesModule,
	generateRouterModule,
	serverRoutes,
	staticRoutePaths,
} from "./codegen.ts";
import {
	ENDPOINTS_ID,
	handleServerRequest,
	HOOKS_ID,
	PAGES_ID,
	prerenderServerFiles,
} from "./dev.ts";
import { isRootShell, previewPages, resolveShell, shellOutputPlugin } from "./html.ts";
import { isRouteFileName, scanRoutes, type RouteNode, type RouteTree } from "./scan.ts";
import { DEFAULT_ALIASES, IMPLEMENT_DIR, writeGenerated } from "./typegen.ts";

export type { DataChain, PageRoute, ServerRoute } from "./codegen.ts";
export type { ExtensionEndpoint, RouteTree } from "./scan.ts";
export { sync } from "./sync.ts";

const ROUTER_ID = "$implement/router";
const RESOLVED_ROUTER_ID = "\0$implement/router";
const RESOLVED_PAGES_ID = `\0${PAGES_ID}`;
const RESOLVED_ENDPOINTS_ID = `\0${ENDPOINTS_ID}`;
const RESOLVED_HOOKS_ID = `\0${HOOKS_ID}`;
/** Server-only virtual modules, which must never reach the browser bundle. */
const SERVER_IDS = [RESOLVED_PAGES_ID, RESOLVED_ENDPOINTS_ID, RESOLVED_HOOKS_ID];
const ENTRY_SERVER = `/${IMPLEMENT_DIR}/entry-server.ts`;
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
	/**
	 * Server hooks file relative to the Vite root, run around every server
	 * request. @default "src/hooks.server.ts"
	 */
	hooks?: string;
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
 * `src/hooks.server.ts` wraps all of that: its `handle` hook runs for every
 * server request — pages, endpoints, and the `__data.json` payload behind a
 * client navigation — and produces the response by calling `resolve(event)`,
 * with `event.locals` carrying whatever it wants the route's loads and
 * handlers to see. See `@implementjs/kit/server` for the hook types.
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
 * The app's html shell lives at `src/index.html` and loads the generated
 * client entry:
 *
 * ```html
 * <script type="module" src="/.implement/entry-client.ts"></script>
 * ```
 *
 * Vite only serves an `index.html` at its root, so kit serves the one under
 * `src/` itself in dev and moves it back to the root of the build output. A
 * root `index.html` still works for apps that want it there.
 */
export function kit(options: KitOptions = {}): Plugin[] {
	const routes = options.routes ?? "src/routes";
	const routesBase = `/${routes.replaceAll("\\", "/")}`;
	const hooksPath = (options.hooks ?? "src/hooks.server.ts").replaceAll("\\", "/");
	const aliases = { ...DEFAULT_ALIASES, ...options.alias };
	const genOptions = { routes, alias: options.alias };
	let root = process.cwd();
	let routesDir = join(root, routes);
	let hooksFile = join(root, hooksPath);
	let tree: RouteTree | null = null;
	let shell: { path: string; relative: string } | null = null;
	let outDir = join(root, "dist");

	/** The app's hooks module as an import specifier, or `null` when it has none. */
	const hooksSpecifier = (): string | null => (existsSync(hooksFile) ? `/${hooksPath}` : null);

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
				entry: ENTRY_SERVER,
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
			// a shell outside the root is not something Vite would pick up on its own, so point the
			// build at it here — `configResolved` is too late for rollup's input. A root `index.html`
			// is already Vite's default entry and is left well alone.
			const shellPath = resolveShell(appRoot);
			const overrideInput =
				shellPath !== null &&
				!isRootShell(shellPath.relative) &&
				userConfig.build?.rollupOptions?.input === undefined;
			return {
				// kit answers page requests itself, so Vite's html fallback and
				// index.html middlewares must stay out of the way — the request
				// has to reach the pipeline with its headers intact for hooks
				appType: "custom",
				publicDir: userConfig.publicDir ?? "static",
				resolve: { alias },
				...(overrideInput ? { build: { rollupOptions: { input: shellPath.path } } } : {}),
			};
		},
		configResolved(config) {
			root = config.root;
			routesDir = join(root, routes);
			hooksFile = join(root, hooksPath);
			outDir = resolve(root, config.build.outDir);
			shell = resolveShell(root);
			const scanned = scan();
			writeGenerated(root, scanned, genOptions);
			if (scanned.error !== null) prerenderConfig.notFound = NOT_FOUND_ROUTE;
		},
		resolveId(id) {
			if (id === ROUTER_ID) return RESOLVED_ROUTER_ID;
			if (id === PAGES_ID) return RESOLVED_PAGES_ID;
			if (id === ENDPOINTS_ID) return RESOLVED_ENDPOINTS_ID;
			if (id === HOOKS_ID) return RESOLVED_HOOKS_ID;
			return null;
		},
		load(id, loadOptions) {
			if (id === RESOLVED_ROUTER_ID) {
				return generateRouterModule(tree ?? scan(), routesBase);
			}
			if (SERVER_IDS.includes(id)) {
				// server files must never reach the browser bundle
				if (loadOptions?.ssr !== true) {
					throw new Error(`${id.slice(1)} is server-only and cannot be imported by client code`);
				}
				if (id === RESOLVED_PAGES_ID) return generatePagesModule(tree ?? scan(), routesBase);
				if (id === RESOLVED_ENDPOINTS_ID)
					return generateEndpointsModule(tree ?? scan(), routesBase);
				return generateHooksModule(hooksSpecifier());
			}
			return null;
		},
		configurePreviewServer(server) {
			// after preview's own static middleware, so it only sees what missed
			return () => {
				server.middlewares.use(previewPages(outDir));
			};
		},
		configureServer(server) {
			const isRouteFile = (file: string) =>
				(file.startsWith(routesDir + sep) && isRouteFileName(basename(file))) || file === hooksFile;
			const regenerate = () => {
				try {
					writeGenerated(root, scan(), genOptions);
				} catch (error) {
					server.config.logger.error(
						`route scan failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}
				for (const id of [RESOLVED_ROUTER_ID, ...SERVER_IDS]) {
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

			// a returned hook runs after Vite's own middlewares are installed, so
			// assets, source modules, and `static/` are served before the app's
			// pipeline sees a request — the order a deployed kit app has too
			return () => {
				server.middlewares.use((req, res, next) => {
					if (res.writableEnded) return next();
					handleServerRequest({
						server,
						req,
						res,
						entry: ENTRY_SERVER,
						shell: shell?.path ?? null,
					}).then((handled) => {
						if (!handled) next();
					}, next);
				});
			};
		},
	};

	return [
		kitPlugin,
		shellOutputPlugin(),
		implement({
			entry: ENTRY_SERVER,
			// kit serves dev pages itself, through the request pipeline
			devSsr: false,
			prerender: options.prerender === false ? false : prerenderConfig,
		}),
	];
}
