import { existsSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import {
	crawlRoutes,
	implement,
	normalizeRoute,
	type RenderFn,
	type PrerenderOptions,
} from "@implementjs/vite";
import type { Plugin, ViteDevServer } from "vite";
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
import {
	evaluateEnvFile,
	exportNames,
	loadRawEnv,
	serializeEnvModule,
	serverStubModule,
	type EnvFileInfo,
} from "./env.ts";
import {
	displayId,
	importerChain,
	isServerModule,
	isServerSpecifier,
	serverImportError,
	type ImporterLookup,
} from "./guard.ts";
import { isRootShell, previewPages, resolveShell, shellOutputPlugin } from "./html.ts";
import { manifestPath, preloadHints } from "./preload.ts";
import { isRouteFileName, scanRoutes, type RouteNode, type RouteTree } from "./scan.ts";
import { DEFAULT_ALIASES, IMPLEMENT_DIR, writeGenerated } from "./typegen.ts";

export type { DataChain, PageRoute, ServerRoute } from "./codegen.ts";
export { defineEnv, PUBLIC_PREFIX, type Env, type EnvKind, type EnvSchemas } from "./env.ts";
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

const DEFAULT_ENV_PUBLIC = "src/lib/env.public.ts";
const DEFAULT_ENV_SERVER = "src/lib/env.server.ts";

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
	/**
	 * Where the two environment-variable files live, relative to the Vite root.
	 * A file that does not exist simply turns that half of the feature off.
	 *
	 * @default { public: "src/lib/env.public.ts", server: "src/lib/env.server.ts" }
	 */
	env?: { public?: string; server?: string };
};

/** One of the two env files, resolved against the Vite root. */
type EnvFile = { path: string; info: EnvFileInfo };

/**
 * The two env files as absolute paths. Existence is not checked: the transform
 * only ever sees an id Vite already loaded, so a file that is not there is a
 * file nothing imports, and that half of the feature is simply off.
 */
function resolveEnvFiles(root: string, option: KitOptions["env"]): EnvFile[] {
	const publicFile = normalizeFile(option?.public ?? DEFAULT_ENV_PUBLIC);
	const serverFile = normalizeFile(option?.server ?? DEFAULT_ENV_SERVER);
	return [
		{
			path: normalizeFile(join(root, publicFile)),
			info: { kind: "public", file: publicFile, counterpart: serverFile },
		},
		{
			path: normalizeFile(join(root, serverFile)),
			info: { kind: "server", file: serverFile, counterpart: publicFile },
		},
	];
}

/** The environment a hook is running for — the client bundle, or a server graph. */
type EnvironmentLike = { name: string; config?: { consumer?: string } };

function isClientGraph(environment: EnvironmentLike | undefined, ssr?: boolean): boolean {
	if (environment === undefined) return ssr !== true;
	const consumer = environment.config?.consumer;
	return consumer === undefined ? environment.name === "client" : consumer === "client";
}

function withoutQuery(id: string): string {
	const cut = id.search(/[?#]/);
	return cut === -1 ? id : id.slice(0, cut);
}

function normalizeFile(file: string): string {
	return file.replaceAll("\\", "/");
}

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
 * Routes are code-split: each page and layout is its own chunk, so a visitor
 * downloads the prerendered html plus the code for the route they landed on,
 * and the rest arrives as they navigate. The prerendered pages carry
 * `modulepreload` hints for their own chunks, so the first load fetches them
 * alongside the entry rather than after it.
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
	let devServer: ViteDevServer | null = null;
	/** Client-graph parents, recorded as rollup parses, for the importer chain. */
	const clientParents = new Map<string, string>();
	let envFiles: EnvFile[] = [];
	let envValues: Record<string, string | undefined> = {};
	let aliasTargets: Record<string, string> = {};

	/** The app's hooks module as an import specifier, or `null` when it has none. */
	const hooksSpecifier = (): string | null => (existsSync(hooksFile) ? `/${hooksPath}` : null);

	/** The evaluated exports of an env file, re-emitted as a module of literals. */
	const inlineEnv = async (file: EnvFile): Promise<string> => {
		const exports = await evaluateEnvFile({
			path: file.path,
			info: file.info,
			values: envValues,
			root,
			alias: aliasTargets,
		});
		return serializeEnvModule(exports, file.info.file);
	};

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
				build: {
					// the prerender needs chunk filenames to emit preload hints for
					// each route's own modules, and only the manifest has them
					manifest: userConfig.build?.manifest ?? true,
					...(overrideInput ? { rollupOptions: { input: shellPath.path } } : {}),
				},
			};
		},
		configResolved(config) {
			root = config.root;
			routesDir = join(root, routes);
			hooksFile = join(root, hooksPath);
			outDir = resolve(root, config.build.outDir);
			shell = resolveShell(root);
			envFiles = resolveEnvFiles(root, options.env);
			// loadEnv does not populate process.env, so the env files cannot read it and expect
			// .env to work — kit sources the raw values here and hands them to the evaluator.
			// `envDir: false` turns .env files off entirely, leaving the environment itself.
			envValues = config.envDir === false ? process.env : loadRawEnv(config.mode, config.envDir);
			aliasTargets = Object.fromEntries(
				Object.entries(aliases).map(([name, target]) => [name, resolve(root, target)]),
			);
			const scanned = scan();
			writeGenerated(root, scanned, genOptions);
			if (scanned.error !== null) prerenderConfig.notFound = NOT_FOUND_ROUTE;
			prerenderConfig.transformHtml = preloadHints({
				manifest: manifestPath(outDir, config.build.manifest),
				routesBase,
				tree: () => tree ?? scan(),
			});
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
		/**
		 * Whole-module replacement, branching on the environment. The public file
		 * becomes literals in both graphs; the server file becomes literals on the
		 * server and, in the client graph, a throwing body holding no values at all
		 * — so even a total guard bypass leaks nothing.
		 *
		 * Every export is inlined, not just the `defineEnv(...)` call: narrowing the
		 * replacement to the call expression would leave `import { z } from "zod"`
		 * and the schema expressions in the module, and "probably tree-shakes"
		 * undercuts the whole reason for evaluating these files up front.
		 */
		async transform(code, id) {
			const normalized = normalizeFile(id);
			const file = withoutQuery(normalized);
			const client = isClientGraph(this.environment);
			for (const env of envFiles) {
				if (env.path !== file) continue;
				if (env.info.kind === "public" || !client) {
					return { code: await inlineEnv(env), map: null };
				}
			}
			// Layer 2: the client copy of any server file keeps its shape and throws. The full id
			// goes in, not the stripped path — `?raw` asks for the file's text, not its bindings.
			if (client && isServerModule(normalized)) {
				return {
					code: serverStubModule(await exportNames(file), displayId(file, root)),
					map: null,
				};
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
			devServer = server;
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
			// Inlined literals do not hot-patch sensibly, so an edited env file invalidates its
			// copy in every graph and forces a reload. Vite already restarts the server on a
			// .env change, which re-reads the raw values from scratch.
			const onEnvFile = (file: string) => {
				const normalized = normalizeFile(file);
				if (!envFiles.some((env) => env.path === normalized)) return;
				for (const environment of Object.values(server.environments)) {
					for (const mod of environment.moduleGraph.getModulesByFile(normalized) ?? []) {
						environment.moduleGraph.invalidateModule(mod);
					}
				}
				server.ws.send({ type: "full-reload" });
			};

			server.watcher.on("add", onFile);
			server.watcher.on("unlink", onFile);
			server.watcher.on("unlinkDir", onDir);
			server.watcher.on("add", onEnvFile);
			server.watcher.on("change", onEnvFile);
			server.watcher.on("unlink", onEnvFile);

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

	/**
	 * Layer 1, keyed on the importer: a client-graph module reaching for a server
	 * file. Keying on the importer is what keeps it from firing while the client
	 * copy of a server file resolves its own imports — that module is Layer 2's
	 * job, and a guard that fired here would make it unreachable.
	 *
	 * `enforce: "pre"` because `vite:alias` resolves and short-circuits, so an
	 * aliased `@/lib/env.server` never reaches a normally-ordered `resolveId`.
	 */
	const guardPlugin: Plugin = {
		name: "implement-kit-guard",
		enforce: "pre",
		/**
		 * Rollup fills `ModuleInfo.importers` in as it goes and Vite's dev container
		 * does not implement it at all, so the chain is recorded here instead — a
		 * module is parsed before rollup follows its imports, so every ancestor of a
		 * violation is already known by the time the violation resolves.
		 */
		moduleParsed(info) {
			if (!isClientGraph(this.environment)) return;
			for (const imported of info.importedIds) {
				if (!clientParents.has(imported)) clientParents.set(imported, info.id);
			}
		},
		async resolveId(source, importer) {
			if (
				importer === undefined ||
				importer.startsWith("\0") ||
				// vite's plugin container attributes a bare request to the root index.html, so an
				// html importer is usually no importer at all — and a shell that really does point
				// a <script> at a server file is Layer 2's to answer, loudly, at evaluation
				importer.endsWith(".html") ||
				!isServerSpecifier(source) ||
				isServerModule(importer) ||
				!isClientGraph(this.environment)
			) {
				return null;
			}
			const resolved = await this.resolve(source, importer, { skipSelf: true });
			if (resolved === null || !isServerModule(resolved.id)) return null;
			// vite resolves a queried module against its own clean path (`x.server.ts?raw` asks to
			// resolve `x.server.ts` with `x.server.ts?raw` as the importer). A module never imports
			// itself, so that pairing is bookkeeping rather than a violation.
			if (withoutQuery(resolved.id) === withoutQuery(importer)) return null;
			const importers: ImporterLookup = (id) => {
				const parent = clientParents.get(id);
				if (parent !== undefined) return [parent];
				const mod = devServer?.environments.client.moduleGraph.getModuleById(id);
				if (mod == null) return [];
				return [...mod.importers].map((node) => node.id ?? node.file ?? "").filter(Boolean);
			};
			return this.error(
				serverImportError({
					server: resolved.id,
					importer,
					source,
					chain: importerChain(importer, importers),
					root,
				}),
			);
		},
	};

	return [
		guardPlugin,
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
