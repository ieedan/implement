import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { crawlRoutes, implement, normalizeRoute, type PrerenderOptions } from "@implementjs/vite";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import type { Adapter } from "./adapter.ts";
import { OUTPUT_DIR, runAdapter } from "./build.ts";
import {
	apiRoutes,
	EMPTY_CONVERTERS,
	generateConvertersModule,
	generateEndpointsModule,
	generateHooksModule,
	generatePagesModule,
	generateParamsModule,
	generateRouterModule,
	routeModuleId,
	serverRoutes,
	staticRoutePaths,
	type ClientStyle,
} from "./codegen.ts";
import {
	ENDPOINTS_ID,
	handleServerRequest,
	handleUpgrade,
	HOOKS_ID,
	PAGES_ID,
	prerenderServerFiles,
	taggedWarning,
} from "./dev.ts";
import {
	evaluateEnvFile,
	exportNames,
	loadRawEnv,
	serializeEnvModule,
	injectPublicEnvBoot,
	publicEnvClientModule,
	serverStubModule,
	setDynamicEnv,
	type EnvFileInfo,
} from "./env.ts";
import {
	chainLinks,
	displayId,
	importerChain,
	isEndpointModule,
	isEndpointSpecifier,
	isServerModule,
	isServerSpecifier,
	scanImports,
	serverImportError,
	type ImporterLookup,
	type ImportSiteLookup,
	type ServerKind,
} from "./guard.ts";
import { isRootShell, previewPages, resolveShell, shellOutputPlugin } from "./html.ts";
import { buildOpenApiDocument, type OpenApiEndpoint, type OpenApiOptions } from "./openapi.ts";
import { builtinMatchers, matcherTable, type ParamMatchers } from "./params.ts";
import type { PreloadOptions } from "./preload-kinds.ts";
import { manifestPath, preloadHints } from "./preload.ts";
import { prerenderPolicy, type PrerenderDefault, type PrerenderPolicy } from "./prerender.ts";
// type-only, so the plugin does not pull the request pipeline into a config file
import type { CsrfOptions } from "./server.ts";
import type { KitPluginApi } from "./sync.ts";
import {
	ENDPOINT_FILE,
	formatRouteWarning,
	isRouteFileName,
	LAYOUT_SERVER_FILE,
	PAGE_SERVER_FILE,
	parseRouteFileName,
	routeFileSuggestion,
	scanRoutes,
	type RouteNode,
	type RouteTree,
	type RouteWarning,
} from "./scan.ts";
import {
	DEFAULT_ALIASES,
	DEFAULT_PARAMS_DIR,
	IMPLEMENT_DIR,
	routerAliases,
	ROUTER_PACKAGE,
	writeGenerated,
} from "./typegen.ts";

export type {
	Adapter,
	AdapterBuild,
	BuildLogger,
	Builder,
	BuiltRoutes,
	Prerendered,
} from "./adapter.ts";
export { assertNoSockets } from "./adapter.ts";
export type { ClientStyle, DataChain, PageRoute, ServerRoute } from "./codegen.ts";
export type { OpenApiDocument, OpenApiOptions, ToJsonSchema } from "./openapi.ts";
export type { PreloadCodeKind, PreloadDataKind, PreloadOptions } from "./preload-kinds.ts";
export type { PrerenderDefault } from "./prerender.ts";
export type { CsrfOptions } from "./server.ts";
export {
	isParamMatcher,
	matcher,
	mismatch,
	type AnyParamMatcher,
	type ParamMatcher,
	type ParamMatchers,
	type ParamType,
} from "./params.ts";
export { defineEnv, PUBLIC_PREFIX, type Env, type EnvKind, type EnvSchemas } from "./env.ts";
export type { ExtensionEndpoint, RouteTree } from "./scan.ts";
export { sync, type KitPluginApi } from "./sync.ts";

const ROUTER_ID = "$implement/router";
/** The app's param matchers. Needed in both graphs — a matcher runs on both sides of a navigation. */
const PARAMS_ID = "$implement/params";
/**
 * `invalidate` / `invalidateAll`, the app-facing half of the client data
 * runtime. Nothing about it is generated — it is a virtual module so an app
 * reaches it through the same `$implement/*` namespace as its router and its
 * client, rather than importing kit's runtime entry by name.
 */
const NAVIGATION_ID = "$implement/navigation";
/** The generated client, aliased to the real `.implement/client.ts` file. */
const CLIENT_ID = "$implement/client";
/**
 * What a route file's `./$types` resolves to at runtime. The declaration half
 * is per-route (`.implement/types/…/$types.d.ts`); the runtime half is the same
 * for every route, because params are purely type-level.
 */
/**
 * The JSON-Schema converters the app has installed, each behind a static
 * import so the bundler writes them into the server bundle.
 *
 * Kit converts a Standard Schema to JSON Schema through the vendor's own
 * converter package, and two of those conversions happen at runtime rather than
 * at build time: an MCP route's `tools/list`, and the live `api.openapi.path`.
 * Reached through a variable specifier, the converter is invisible to the
 * bundler and never ships — and an adapter's output has no `node_modules` for a
 * bare specifier to fall back on, so the import fails on every request.
 * Statically importing them from kit is not an option either: an app that uses
 * one vendor does not have the other's converter installed, and the build would
 * fail on a package it has no reason to own.
 *
 * So the list is decided here, per app, from what actually resolves.
 */
const CONVERTERS_ID = "$implement/schema-converters";
const RESOLVED_CONVERTERS_ID = `\0${CONVERTERS_ID}`;
const TYPES_ID = "\0$implement/route-types";
const TYPES_MODULE = 'export { handler, json, socket, sse } from "@implementjs/kit/endpoint";\n';
const RESOLVED_ROUTER_ID = "\0$implement/router";
const RESOLVED_PARAMS_ID = `\0${PARAMS_ID}`;
const RESOLVED_NAVIGATION_ID = `\0${NAVIGATION_ID}`;
const NAVIGATION_MODULE = 'export { invalidate, invalidateAll } from "@implementjs/kit/runtime";\n';
const RESOLVED_PAGES_ID = `\0${PAGES_ID}`;
const RESOLVED_ENDPOINTS_ID = `\0${ENDPOINTS_ID}`;
const RESOLVED_HOOKS_ID = `\0${HOOKS_ID}`;
/** Server-only virtual modules, which must never reach the browser bundle. */
const SERVER_IDS = [RESOLVED_PAGES_ID, RESOLVED_ENDPOINTS_ID, RESOLVED_HOOKS_ID];
const ENTRY_SERVER = `/${IMPLEMENT_DIR}/entry-server.ts`;
/** Deliberately unmatched, so the fallback renders for the 404 page. */
const NOT_FOUND_ROUTE = "/__implement__/not-found";

/**
 * The bare imports kit's generated modules make that nothing on disk does.
 *
 * Vite's dep scanner externalizes anything whose resolved id carries a `\0`,
 * so the crawl that decides what to prebundle stops dead at every virtual
 * module kit owns. `$implement/router` is imported by the generated client
 * entry, and the scanner walks straight past it — so the packages behind it
 * are invisible at startup, discovered instead by the browser on first load.
 * A dep discovered then re-bundles, which moves every optimized URL's `?v=`
 * hash and answers the requests already in flight with
 * `504 (Outdated Optimize Dep)`.
 *
 * Naming them here puts them in the first prebundle instead. `params` is here
 * even for an app with no matchers yet: adding the first one would otherwise
 * be its own discovery, mid-session, with the dev server already running.
 *
 * `navigation` is here for a second reason, and a sharper one: it re-exports
 * the runtime's preload functions, so leaving it out does not merely delay a
 * prebundle — it *duplicates the runtime*. The generated client entry would
 * import it as source while `$implement/router` imports the prebundled
 * `runtime`, and the route tables the router registers would be registered
 * into a module instance the preloader cannot see. Every preload would then
 * quietly no-op: two registries, one of them empty.
 */
/**
 * Never pre-bundled for a browser: the plugin entry is a build tool, imported
 * by the env files for `defineEnv` and replaced with literals long before a
 * bundle is written.
 */
const OPTIMIZE_EXCLUDE = ["@implementjs/kit"];

const OPTIMIZE_INCLUDE = [
	ROUTER_PACKAGE,
	"@implementjs/kit/navigation",
	"@implementjs/kit/params",
	"@implementjs/kit/runtime",
];

/** Writes a file, creating its directory — the build's own small needs. */
function write(file: string, contents: string): void {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, contents);
}

const DEFAULT_ENV_PUBLIC = "src/lib/env.public.ts";
const DEFAULT_ENV_SERVER = "src/lib/env.server.ts";
const DEFAULT_ENV_DYNAMIC = "src/lib/env.dynamic.server.ts";
const DEFAULT_ENV_DYNAMIC_PUBLIC = "src/lib/env.dynamic.public.ts";

export type KitPrerenderOptions = {
	/**
	 * Routes to prerender beyond the statically known pages and the internal
	 * link crawl — fill in dynamic `[param]` routes here.
	 */
	entries?: string[] | (() => string[] | Promise<string[]>);
	/**
	 * What a route prerenders when it does not say for itself. Routes say so by
	 * exporting `prerender` from their `page.server.ts`, `layout.server.ts`
	 * (which cascades to everything under it), or `server.ts`.
	 *
	 * Without a server to fall back on, everything prerenders — that is the
	 * only thing a static build can mean, and it is the default with no adapter
	 * or a static one. An adapter that ships a server defaults to `"auto"`
	 * instead: pages with no server load prerender, pages with one are rendered
	 * per request, and endpoints wait for the server. Set it here to override
	 * either.
	 */
	default?: PrerenderDefault;
};

export type KitOptions = {
	/** Routes directory relative to the Vite root. @default "src/routes" */
	routes?: string;
	/**
	 * Where the app's route param matchers live, relative to the Vite root.
	 * One `<name>.ts` per matcher, default-exporting a
	 * [`matcher()`](https://implementjs.dev/kit/routing#param-matchers); a
	 * `[id=<name>]` route directory names one. A directory that does not exist
	 * is simply an app with no matchers.
	 *
	 * @default "src/params"
	 */
	params?: string;
	/**
	 * Server hooks file relative to the Vite root, run around every server
	 * request. @default "src/hooks.server.ts"
	 */
	hooks?: string;
	/** Prerender the built site. @default true */
	prerender?: boolean | KitPrerenderOptions;
	/**
	 * What to do with the finished build. Without one, `vite build` writes a
	 * static site straight to `build.outDir` and anything a request has to be
	 * present for — a `POST` endpoint, a load that reads the session — has
	 * nowhere to run.
	 *
	 * With one, the build is staged under `.implement/output` (`client/` and,
	 * for an adapter that ships a server, `server/`) and the adapter turns that
	 * into whatever its host deploys.
	 *
	 * ```ts
	 * import node from "@implementjs/adapter-node";
	 * kit({ adapter: node() });
	 * ```
	 */
	adapter?: Adapter;
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
	 * The typed API layer over the app's `server.ts` endpoints.
	 *
	 * The client is always generated — `$implement/client` exports a ready-made
	 * `api`, and `event.api` binds the same client to the in-process fetch — so
	 * this is only here to change its shape. An OpenAPI document is the
	 * opposite: nothing is produced unless `openapi` is set, because a route
	 * table is not something to publish by accident.
	 *
	 * ```ts
	 * kit({
	 * 	api: {
	 * 		client: { style: "nested", errors: "result" },
	 * 		openapi: { info: { title: "Docs API", version: "1.0.0" }, output: "static/openapi.json" },
	 * 	},
	 * });
	 * ```
	 */
	api?: KitApiOptions;
	/**
	 * Where the environment-variable files live, relative to the Vite root. A
	 * file that does not exist simply turns that part of the feature off.
	 *
	 * `public` and `server` are evaluated once during the build and re-emitted
	 * as literals. `dynamic` and `dynamicPublic` are left alone and read by the
	 * running server, so rotating what they declare is a restart rather than a
	 * rebuild — `dynamic` must be named `*.server.ts`, and `dynamicPublic` must
	 * not be, since its values are meant to reach the browser.
	 *
	 * @default { public: "src/lib/env.public.ts", server: "src/lib/env.server.ts", dynamic: "src/lib/env.dynamic.server.ts", dynamicPublic: "src/lib/env.dynamic.public.ts" }
	 */
	env?: { public?: string; server?: string; dynamic?: string; dynamicPublic?: string };
	/**
	 * What a link preloads before it is followed — the route's chunks, its
	 * `__data.json`, or neither. A navigation resolves both before it commits,
	 * so warming them while the pointer is still over the link is what takes
	 * the round trip out from under the click.
	 *
	 * This is only the default. Any element may carry
	 * `data-implement-preload-data` or `data-implement-preload-code`, and the
	 * links beneath it take the nearest one — which is how a link whose load is
	 * expensive enough that a passing pointer should not run it opts out:
	 *
	 * ```html
	 * <a href="/reports/annual" data-implement-preload-data="tap">Annual report</a>
	 * ```
	 *
	 * ```ts
	 * // warm chunks as links scroll into view; leave data to the click
	 * kit({ preload: { code: "viewport", data: "off" } });
	 * ```
	 *
	 * @default { data: "hover", code: "hover" }
	 */
	preload?: PreloadOptions;
	/**
	 * The one thing kit does about where a request came from: reject a
	 * cross-site **form** submission that mutates — a `POST`, `PUT`, `PATCH`, or
	 * `DELETE` carrying `application/x-www-form-urlencoded`, `multipart/form-data`,
	 * or `text/plain`, the content types a page on another origin can send at
	 * your app with no preflight and no opt-in from you.
	 *
	 * Nothing else is gated. Kit adds no `access-control-*` headers to anything,
	 * so a `GET` endpoint is reachable cross-origin and a browser reads its body
	 * only if the endpoint says so itself — see
	 * [server routes](https://implementjs.dev/kit/server-routes#cross-origin-requests).
	 *
	 * ```ts
	 * // let one other origin post forms here
	 * kit({ csrf: { trustedOrigins: ["https://admin.example.com"] } });
	 * ```
	 *
	 * @default { checkOrigin: true, trustedOrigins: [] }
	 */
	csrf?: CsrfOptions;
};

export type KitApiOptions = {
	/** How the generated client is called and what it hands back. */
	client?: ClientStyle;
	/**
	 * The OpenAPI 3.1 document for the app's endpoints. Omit this — the default
	 * — and none is produced: no file is written and no route is mounted.
	 */
	openapi?: OpenApiOptions;
};

/** One of the two env files, resolved against the Vite root. */
type EnvFile = { path: string; info: EnvFileInfo };

/**
 * The env files as absolute paths. Existence is not checked: the transform only
 * ever sees an id Vite already loaded, so a file that is not there is a file
 * nothing imports, and that part of the feature is simply off.
 *
 * @throws {Error} if the dynamic file is not named `*.server.ts`.
 */
function resolveEnvFiles(root: string, option: KitOptions["env"]): EnvFile[] {
	const publicFile = normalizeFile(option?.public ?? DEFAULT_ENV_PUBLIC);
	const serverFile = normalizeFile(option?.server ?? DEFAULT_ENV_SERVER);
	const dynamicFile = normalizeFile(option?.dynamic ?? DEFAULT_ENV_DYNAMIC);
	const dynamicPublicFile = normalizeFile(option?.dynamicPublic ?? DEFAULT_ENV_DYNAMIC_PUBLIC);
	// the static files are replaced wholesale, so the browser copy is kit's to
	// write either way. The dynamic file keeps its own body, which leaves the
	// `*.server.ts` guard as the only thing standing between it and a bundle
	if (!isServerModule(dynamicFile)) {
		throw new Error(
			`kit({ env: { dynamic } }): "${dynamicFile}" must be named \`*.server.ts\`.\n\n` +
				`Unlike the other two, this file is not replaced at build time — the name is what makes it server-only and keeps its values out of the client bundle.`,
		);
	}
	// the mirror image: this file's values are meant to reach the browser, and
	// `*.server.ts` is the one name that guarantees they never will
	if (isServerModule(dynamicPublicFile)) {
		throw new Error(
			`kit({ env: { dynamicPublic } }): "${dynamicPublicFile}" must not be named \`*.server.ts\`.\n\n` +
				`Every variable in this file is shipped to the browser, and a \`*.server.ts\` file is one kit refuses to let client code import.`,
		);
	}
	return [
		{
			path: normalizeFile(join(root, publicFile)),
			info: { kind: "public", file: publicFile, counterpart: serverFile },
		},
		{
			path: normalizeFile(join(root, dynamicPublicFile)),
			info: { kind: "dynamic-public", file: dynamicPublicFile, counterpart: serverFile },
		},
		{
			path: normalizeFile(join(root, serverFile)),
			info: { kind: "server", file: serverFile, counterpart: publicFile },
		},
		{
			path: normalizeFile(join(root, dynamicFile)),
			info: { kind: "dynamic", file: dynamicFile, counterpart: publicFile },
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

/**
 * The `import.meta.hot` block appended to every page and layout in dev.
 *
 * Making the route files the app's hot-update boundaries is the whole point:
 * without one, an edit anywhere under `src/` climbs the import graph to the
 * client entry, and re-running that entry rebuilds the app from nothing. The
 * accept below stops the climb one module short of the router, hands the new
 * component to the handle the route table already closed over, and re-renders
 * only that level of the chain.
 *
 * The import goes last on purpose: appending leaves every line above it where
 * it was, so the module's sourcemap still lines up and the transform can
 * report `map: null`. ESM hoists it, so it is loaded before the module body
 * either way.
 */
function routeHotFooter(id: string): string {
	return `
if (import.meta.hot) {
	import.meta.hot.accept((module) => {
		// no module means the update failed to evaluate; a handle that does not
		// exist means the route tree moved out from under the running router.
		// Either way this file has no boundary to offer, so hand it back to Vite.
		if (module === undefined || !__implementHotReplaceRoute(${JSON.stringify(id)}, module.default)) {
			import.meta.hot.invalidate();
		}
	});
}
import { hotReplaceRoute as __implementHotReplaceRoute } from "@implementjs/kit/runtime";
`;
}

/** Whether a specifier is worth resolving to find out whether it is server-only. */
function looksServerOnly(source: string): boolean {
	return isServerSpecifier(source) || isEndpointSpecifier(source);
}

/** Whether a specifier's last segment names the same file as `id` — an ordering hint, not a decision. */
function sameStem(source: string, id: string): boolean {
	const stem = (value: string): string =>
		(withoutQuery(value).split("/").pop() ?? "").replace(/\.[cm]?[jt]sx?$/, "");
	return stem(source) === stem(id);
}

const treeHasLoads = (node: RouteNode): boolean =>
	node.pageServer !== null || node.layoutServer !== null || node.children.some(treeHasLoads);

/**
 * File-based routing for implement apps. Scans `src/routes` — `page.ts` is a
 * page, `layout.ts` wraps everything beneath it, `[param]` and `[...rest]`
 * directories bind params, `(group)` directories scope a layout without
 * adding a URL segment, `page@<segment>.ts` / `layout@<segment>.ts` reset
 * the layout chain to an ancestor segment (`page@.ts` resets to the root),
 * and an `error.ts` renders unmatched paths and render errors for its own
 * subtree —
 * and serves the app through `@implementjs/vite`'s SSR dev server and
 * prerenderer. The router itself is exposed as the `$implement/router`
 * virtual module; generated entries, `./$types` declarations, and the
 * tsconfig apps extend land in `.implement/`.
 *
 * Server files run only on the server (dev requests and the prerender):
 * `page.server.ts` / `layout.server.ts` export a load function whose result
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
	const paramsPath = options.params ?? DEFAULT_PARAMS_DIR;
	const paramsBase = `/${paramsPath.replaceAll("\\", "/")}`;
	/** The same two, as the dep scanner wants them: relative to the Vite root. */
	const routesGlob = routesBase.slice(1);
	const paramsGlob = paramsBase.slice(1);
	const hooksPath = (options.hooks ?? "src/hooks.server.ts").replaceAll("\\", "/");
	// the router alias goes under the app's own entries, not over them: an app
	// that installed the router itself, or points the name somewhere on purpose,
	// keeps what it asked for
	const aliases = { ...DEFAULT_ALIASES, ...routerAliases().vite, ...options.alias };
	const genOptions = {
		routes,
		params: paramsPath,
		alias: options.alias,
		client: options.api?.client,
		preload: options.preload,
		csrf: options.csrf,
		dynamicPublicEnv: normalizeFile(options.env?.dynamicPublic ?? DEFAULT_ENV_DYNAMIC_PUBLIC),
	};
	let root = process.cwd();
	let routesDir = join(root, routes);
	let paramsDir = join(root, paramsPath);
	let hooksFile = join(root, hooksPath);
	let tree: RouteTree | null = null;
	let shell: { path: string; relative: string } | null = null;
	let outDir = join(root, "dist");
	let devServer: ViteDevServer | null = null;
	let resolvedConfig: ResolvedConfig | null = null;
	/** Vite's logger once there is a config; `console` for a scan that runs before one. */
	let logger: { warn(message: string): void } = console;
	/** The warnings the last scan reported, so a rescan only speaks up about what changed. */
	let reportedWarnings = new Set<string>();
	/** Client-graph parents, recorded as rollup parses, for the importer chain. */
	const clientParents = new Map<string, string>();

	/**
	 * The two kinds of server-only module, under one question. A route's
	 * `server.ts` is not spelled `*.server.ts`, but it is every bit as server-only
	 * — importing one from a page drags its database and its secrets into the
	 * client bundle — so both layers treat them the same.
	 */
	const serverKind = (id: string): ServerKind | null => {
		if (isServerModule(id)) return "server";
		return isEndpointModule(id, routesDir) ? "endpoint" : null;
	};
	/**
	 * A page or layout — the files that render, and so the only ones a hot
	 * update can swap into a mounted route. `server.ts` and `*.server.ts` never
	 * reach the browser, and an `error.ts` is a static import of the router
	 * module rather than a handle, so neither is a boundary.
	 */
	const isRouteComponent = (file: string): boolean =>
		file.startsWith(`${normalizeFile(routesDir)}/`) && parseRouteFileName(basename(file)) !== null;

	let envFiles: EnvFile[] = [];
	let envValues: Record<string, string | undefined> = {};
	let aliasTargets: Record<string, string> = {};

	/** Where the app's public dynamic env file would be — its being there is what turns it on. */
	const dynamicPublicEnvFile = (): string =>
		envFiles.find((env) => env.info.kind === "dynamic-public")?.path ?? "";

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

	/**
	 * A near miss (`+server.ts`, `page.tsx`) is colocated code as far as the scan
	 * is concerned, so the route it was meant to be simply never exists and
	 * nothing says why; a `layout.server.ts` typed with `LoadEvent` fails with a
	 * `TS2502` that names neither type. Kit says both here instead, once per scan
	 * that turned the warning up anew: a warning that is still there after an
	 * unrelated edit does not repeat itself, and one that comes back after a
	 * rename — or after the wrong import goes back in — is worth repeating.
	 */
	const reportWarnings = (warnings: RouteWarning[]): void => {
		const current = new Set<string>();
		for (const warning of warnings) {
			// the message is the identity: two warnings that read the same are the
			// same warning, whatever kind they came from
			const message = formatRouteWarning(warning, routes);
			current.add(message);
			if (reportedWarnings.has(message)) continue;
			logger.warn(taggedWarning(message));
		}
		reportedWarnings = current;
	};

	const scan = (): RouteTree => {
		tree = scanRoutes(routesDir, paramsDir);
		reportWarnings(tree.warnings);
		return tree;
	};

	const openapi = options.api?.openapi;
	/** What generated code can carry: everything but the converter function. */
	const openapiRoute = openapi === undefined ? undefined : { ...openapi, toJsonSchema: undefined };
	let publicDir: string | false = false;

	/**
	 * Every endpoint with its module evaluated — the one thing the document
	 * needs that nothing else does. `load` is the dev server's `ssrLoadModule`
	 * or the build's module runner; both run in Node, so the schema library
	 * stays out of the production bundle.
	 */
	const openApiEndpoints = async (
		load: (id: string) => Promise<Record<string, unknown>>,
	): Promise<OpenApiEndpoint[]> => {
		const routes = apiRoutes(tree ?? scan());
		const modules = await Promise.all(routes.map((route) => load(`${routesBase}/${route.file}`)));
		return routes.map((route, index) => ({ ...route, module: modules[index]! }));
	};

	/**
	 * The matchers the documented routes name, evaluated the same way — a
	 * `[id=integer]` param is documented as whatever the matcher parses it to,
	 * and the only place that type exists outside TypeScript is the matcher
	 * itself. Only the matchers those routes actually use are loaded.
	 */
	const openApiMatchers = async (
		load: (id: string) => Promise<Record<string, unknown>>,
		endpoints: OpenApiEndpoint[],
	): Promise<ParamMatchers> => {
		const named = new Set(
			endpoints.flatMap((endpoint) =>
				endpoint.params
					.map((param) => param.matcher)
					.filter((name): name is string => name !== null && name !== undefined),
			),
		);
		// a built-in has no module to load, and the app's own file shadows one
		const names = [...named].filter((name) => (tree ?? scan()).matchers.includes(name));
		const modules = await Promise.all(names.map((name) => load(`${paramsBase}/${name}.ts`)));
		return {
			...builtinMatchers,
			...matcherTable(
				Object.fromEntries(names.map((name, index) => [name, modules[index]!["default"]])),
				paramsGlob,
			),
		};
	};

	/** The document as a file, with every warning reported against the route it came from. */
	const openApiJson = async (
		load: (id: string) => Promise<Record<string, unknown>>,
		warn: (message: string) => void,
	): Promise<string> => {
		const endpoints = await openApiEndpoints(load);
		const { document, warnings } = await buildOpenApiDocument(
			endpoints,
			openapi!,
			await openApiMatchers(load, endpoints),
		);
		for (const warning of warnings) warn(`openapi — ${warning}`);
		return `${JSON.stringify(document, null, "\t")}\n`;
	};

	/**
	 * The URL `output` will be served at once the build has written it — only
	 * when it lands inside the public dir, since nothing else is served by path.
	 * Dev answers that URL from the live route tree instead of the stale file.
	 */
	const openApiPublicUrl = (): string | null => {
		if (openapi?.output === undefined || publicDir === false) return null;
		const inside = relative(publicDir, resolve(root, openapi.output)).replaceAll("\\", "/");
		return inside.startsWith("..") ? null : `/${inside}`;
	};

	/** Where the build wrote the document, as site-root-relative paths. */
	let openApiFiles: string[] = [];

	/**
	 * The document as the build's own output: written whatever `prerender` is
	 * set to, because `output` is a file the build owes and the prerender has
	 * no say in it. Building it also surfaces the document's warnings, which
	 * an app serving `path` alone still wants to hear at build time.
	 */
	const writeOpenApi = async (
		load: (id: string) => Promise<Record<string, unknown>>,
		outDir: string,
	): Promise<void> => {
		openApiFiles = [];
		const json = await openApiJson(load, (message) => {
			console.warn(message);
		});
		const output = openapi?.output;
		if (output === undefined) return;
		// two copies: the source one, so the next build's publicDir sweep
		// ships it like any other static file, and one straight into this
		// build's output, so the build that produced the document is not
		// the one build missing it
		write(resolve(root, output), json);
		const url = openApiPublicUrl();
		if (url !== null) {
			write(join(outDir, url.slice(1)), json);
			openApiFiles.push(url);
		}
	};

	const adapter = options.adapter;
	const entriesOption =
		typeof options.prerender === "object" ? options.prerender.entries : undefined;
	/**
	 * What a route prerenders when nothing declares otherwise. A build with no
	 * server to fall back on has to prerender everything; one with a server
	 * prerenders only what is safe to freeze.
	 */
	const prerenderDefault: PrerenderDefault =
		(typeof options.prerender === "object" ? options.prerender.default : undefined) ??
		(adapter === undefined || adapter.server === false ? true : "auto");
	/** Built by the routes pass, and read again by the endpoint pass behind it. */
	let policy: PrerenderPolicy | null = null;
	/** Everything the prerender wrote besides the pages themselves. */
	let prerenderedFiles: string[] = [];

	// notFound is filled in from the scan in configResolved, before closeBundle reads it
	const prerenderConfig: PrerenderOptions = {
		routes: async ({ render, load }) => {
			const scanned = tree ?? scan();
			policy = prerenderPolicy({
				tree: scanned,
				routesBase,
				load,
				fallback: prerenderDefault,
			});
			const entries =
				typeof entriesOption === "function" ? await entriesOption() : (entriesOption ?? []);
			const seeds = [
				...staticRoutePaths(scanned).map(normalizeRoute),
				...entries.map(normalizeRoute),
				"/",
			];
			// the crawl both discovers and filters: a page the policy keeps out of
			// the build is never rendered, so its loads never run at build time
			return await crawlRoutes(render, { from: seeds, follow: (route) => policy!.page(route) });
		},
		after: async ({ routes: prerendered, outDir, load }) => {
			const scanned = tree ?? scan();
			const written = await prerenderServerFiles({
				routes: prerendered,
				outDir,
				load,
				entry: ENTRY_SERVER,
				hasLoads: treeHasLoads(scanned.root),
				serverRoutes: serverRoutes(scanned),
				shouldPrerender: policy === null ? undefined : (route) => policy!.endpoint(route),
				logger: console,
				source: { root, routes },
			});
			prerenderedFiles = written;
		},
	};

	// what `implement-kit sync` reads, so the CLI generates against these same options
	const api: KitPluginApi = { options: genOptions };

	const kitPlugin: Plugin = {
		name: "implement-kit",
		api,
		config(userConfig, env) {
			const appRoot = resolve(userConfig.root ?? ".");
			const alias = {
				...Object.fromEntries(
					Object.entries(aliases).map(([name, target]) => [name, resolve(appRoot, target)]),
				),
				// a real generated file rather than a virtual module: the browser
				// imports it, TypeScript resolves it through the generated
				// tsconfig's paths, and both want the same thing on disk
				[CLIENT_ID]: resolve(appRoot, `${IMPLEMENT_DIR}/client.ts`),
			};
			// the server build kit runs for an adapter loads this same config, and
			// none of the client build's entry, output, or asset wiring is its
			// business — it has an entry of its own and writes somewhere else
			const isServerBuild = env.isSsrBuild === true || userConfig.build?.ssr !== undefined;
			// a shell outside the root is not something Vite would pick up on its own, so point the
			// build at it here — `configResolved` is too late for rollup's input. A root `index.html`
			// is already Vite's default entry and is left well alone.
			const shellPath = resolveShell(appRoot);
			const overrideInput =
				!isServerBuild &&
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
				optimizeDeps: {
					// the route modules and the matchers hang off `$implement/router`,
					// which the scanner will not walk through (see OPTIMIZE_INCLUDE), so
					// point it at the real files instead: their deps are the app's own,
					// and kit cannot name those in advance. Vite concatenates what a
					// plugin returns onto the app's own entries, and the shell is here
					// because listing anything at all replaces what the scan would have
					// crawled by default. `*.server.ts` stays out — a server-only dep has
					// no business in the browser's prebundle.
					entries: [
						...(shellPath === null ? [] : [shellPath.relative.replaceAll("\\", "/")]),
						`${routesGlob}/**/{page,layout}.ts`,
						`${routesGlob}/**/{page,layout}@*.ts`,
						`${routesGlob}/**/error.ts`,
						`${paramsGlob}/*.ts`,
					],
					include: OPTIMIZE_INCLUDE,
					// the plugin entry is a build tool — it imports vite and esbuild.
					// The env files import it for `defineEnv`, and kit replaces those
					// modules wholesale before a browser sees them, but a dep optimizer
					// that reaches one first would try to prebundle a bundler
					exclude: OPTIMIZE_EXCLUDE,
				},
				build: {
					// the prerender needs chunk filenames to emit preload hints for
					// each route's own modules, and only the manifest has them
					manifest: userConfig.build?.manifest ?? true,
					// an adapter owns the deployable output, so the client bundle it
					// is assembled from is staged rather than written where a static
					// build would put it
					...(adapter !== undefined && !isServerBuild ? { outDir: `${OUTPUT_DIR}/client` } : {}),
					...(overrideInput ? { rollupOptions: { input: shellPath.path } } : {}),
				},
			};
		},
		configResolved(config) {
			// the prerender runs a dev server on this same config, and it may well
			// be this same plugin instance answering for it — the adapter stage
			// wants what the client build resolved, not what serving it resolves
			if (config.command === "build" && config.build.ssr === false) resolvedConfig = config;
			logger = config.logger;
			root = config.root;
			routesDir = join(root, routes);
			paramsDir = join(root, paramsPath);
			hooksFile = join(root, hooksPath);
			outDir = resolve(root, config.build.outDir);
			shell = resolveShell(root);
			envFiles = resolveEnvFiles(root, options.env);
			// loadEnv does not populate process.env, so the env files cannot read it and expect
			// .env to work — kit sources the raw values here and hands them to the evaluator.
			// `envDir: false` turns .env files off entirely, leaving the environment itself.
			envValues = config.envDir === false ? process.env : loadRawEnv(config.mode, config.envDir);
			// dev requests and the prerender run in this process, where `.env` never
			// reached `process.env` — so the dynamic file is pointed at the same
			// values the other two were evaluated against. A built server runs
			// elsewhere and falls back to its own `process.env`, or to whatever its
			// adapter hands `setDynamicEnv`.
			setDynamicEnv(envValues);
			publicDir = config.publicDir;
			aliasTargets = Object.fromEntries(
				Object.entries(aliases).map(([name, target]) => [name, resolve(root, target)]),
			);
			const scanned = scan();
			writeGenerated(root, scanned, genOptions);
			// a 404.html is how a static host answers an unknown path; an adapter
			// that ships a server renders the error page per request instead
			if (scanned.error !== null && (adapter === undefined || adapter.server === false)) {
				prerenderConfig.notFound = NOT_FOUND_ROUTE;
			}
			const hints = preloadHints({
				manifest: manifestPath(outDir, config.build.manifest),
				routesBase,
				tree: () => tree ?? scan(),
				base: config.base,
			});
			// A prerendered page was written before there was a request to read the
			// public env for, so it boots from `/_implement/env.js` instead of from
			// values of its own — but only where something will be running to answer
			// it. With no server the page keeps the build's values, which is the same
			// bargain the private dynamic file makes when it is prerendered.
			const bootsEnv =
				existsSync(dynamicPublicEnvFile()) && adapter !== undefined && adapter.server !== false;
			prerenderConfig.transformHtml = bootsEnv
				? (route, html) => injectPublicEnvBoot(hints(route, html), config.base)
				: hints;
		},
		resolveId(id) {
			if (id === ROUTER_ID) return RESOLVED_ROUTER_ID;
			if (id === PARAMS_ID) return RESOLVED_PARAMS_ID;
			if (id === NAVIGATION_ID) return RESOLVED_NAVIGATION_ID;
			if (id === PAGES_ID) return RESOLVED_PAGES_ID;
			if (id === ENDPOINTS_ID) return RESOLVED_ENDPOINTS_ID;
			if (id === HOOKS_ID) return RESOLVED_HOOKS_ID;
			if (id === CONVERTERS_ID) return RESOLVED_CONVERTERS_ID;
			return null;
		},
		async load(id, loadOptions) {
			if (id === RESOLVED_CONVERTERS_ID) {
				// nothing in a browser converts a schema to JSON Schema, and shipping
				// a converter there would be pure weight
				if (isClientGraph(this.environment, loadOptions?.ssr)) return EMPTY_CONVERTERS;
				// resolved the way the build itself would, so an alias, a workspace
				// link, and a pnpm store all answer the same. A package Vite decides
				// to leave external stays a bare specifier in the output, which is
				// exactly what it was before — never worse, and better wherever the
				// adapter bundles
				const importer = join(root, "package.json");
				return await generateConvertersModule(
					async (specifier) =>
						(await this.resolve(specifier, importer, { skipSelf: true })) !== null,
				);
			}
			if (id === RESOLVED_ROUTER_ID) {
				return generateRouterModule(tree ?? scan(), routesBase);
			}
			// not a SERVER_ID: matching happens on both sides of a navigation, so
			// the browser needs the matchers as much as the pipeline does
			if (id === RESOLVED_PARAMS_ID) {
				return generateParamsModule(tree ?? scan(), paramsBase);
			}
			// a function of nothing, so it never goes stale and the route watcher
			// has no reason to invalidate it
			if (id === RESOLVED_NAVIGATION_ID) return NAVIGATION_MODULE;
			if (SERVER_IDS.includes(id)) {
				// server files must never reach the browser bundle
				if (loadOptions?.ssr !== true) {
					throw new Error(`${id.slice(1)} is server-only and cannot be imported by client code`);
				}
				if (id === RESOLVED_PAGES_ID) return generatePagesModule(tree ?? scan(), routesBase);
				if (id === RESOLVED_ENDPOINTS_ID)
					return generateEndpointsModule(tree ?? scan(), routesBase, openapiRoute);
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
		 * replacement to the call expression would leave `import * as v from "valibot"`
		 * and the schema expressions in the module, and "probably tree-shakes"
		 * undercuts the whole reason for evaluating these files up front.
		 */
		async transform(code, id) {
			const normalized = normalizeFile(id);
			const file = withoutQuery(normalized);
			const client = isClientGraph(this.environment);
			for (const env of envFiles) {
				if (env.path !== file) continue;
				// the dynamic files are the ones kit does not inline: their values are
				// not known yet, so the schemas — and the schema library — stay in the
				// server bundle and run there. The private one falls through to the
				// server-file stub below, like any other `*.server.ts`
				if (env.info.kind === "dynamic") break;
				// the public one does reach the browser, but as values rather than as
				// code: the server has already validated and coerced them, so the
				// client copy reads what the page carries and ships no schemas either
				if (env.info.kind === "dynamic-public") {
					if (!client) break;
					return {
						code: publicEnvClientModule(await exportNames(file), displayId(file, root)),
						map: null,
					};
				}
				if (env.info.kind === "public" || !client) {
					return { code: await inlineEnv(env), map: null };
				}
			}
			// Layer 2: the client copy of any server file keeps its shape and throws. The full id
			// goes in, not the stripped path — `?raw` asks for the file's text, not its bindings.
			const kind = client ? serverKind(normalized) : null;
			if (kind !== null) {
				return {
					code: serverStubModule(await exportNames(file), displayId(file, root), kind),
					map: null,
				};
			}
			// Dev only, and only the copy the browser runs: pages and layouts become
			// the app's hot-update boundaries (see `routeHotFooter`). The build has no
			// `import.meta.hot`, and a server graph has nothing to re-render.
			if (devServer !== null && client && isRouteComponent(file)) {
				const id = routeModuleId(routesBase, normalizeFile(relative(routesDir, file)));
				// appended, so nothing above it moves and the existing map still holds
				return { code: `${code}\n${routeHotFooter(id)}`, map: null };
			}
			return null;
		},
		/**
		 * `vite preview` serves what the build wrote: with no adapter that is the
		 * whole site, and with one it is the static half of it. The server half is
		 * the adapter's own artifact — its entry is whatever shape its host wants
		 * — so previewing that means running it (`node dist`, `wrangler dev`).
		 */
		configurePreviewServer(server) {
			// after preview's own static middleware, so it only sees what missed
			return () => {
				server.middlewares.use(previewPages(outDir));
			};
		},
		configureServer(server) {
			devServer = server;
			const isRouteFile = (file: string) =>
				(file.startsWith(routesDir + sep) &&
					// a near miss changes no route, but the rescan is what notices it
					// and warns — writing `+server.ts` into a running dev server is
					// exactly when you want to hear about it
					(isRouteFileName(basename(file)) || routeFileSuggestion(basename(file)) !== null)) ||
				// a matcher appearing or vanishing changes which `[id=name]` routes
				// are valid, and what type every param behind it carries
				(dirname(file) === paramsDir && file.endsWith(".ts")) ||
				file === hooksFile;
			const regenerate = () => {
				try {
					writeGenerated(root, scan(), genOptions);
				} catch (error) {
					server.config.logger.error(
						`route scan failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}
				for (const id of [RESOLVED_ROUTER_ID, RESOLVED_PARAMS_ID, ...SERVER_IDS]) {
					const mod = server.moduleGraph.getModuleById(id);
					if (mod) server.moduleGraph.invalidateModule(mod);
				}
				server.ws.send({ type: "full-reload" });
			};
			const onFile = (file: string) => {
				if (isRouteFile(file)) regenerate();
			};
			const onDir = (dir: string) => {
				if (dir.startsWith(routesDir + sep) || dir === paramsDir) regenerate();
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

			/**
			 * A load or an endpoint that changed. Nothing in the client graph
			 * imports these — the browser holds the *output* of one — so Vite finds
			 * no module to update and sends nothing at all, leaving the page on data
			 * the edit already replaced. It has invalidated the server graph by the
			 * time this runs, so a reload re-renders against the new code.
			 */
			const onServerFile = (file: string) => {
				const name = basename(file);
				const serverRouteFile =
					name === ENDPOINT_FILE || name === PAGE_SERVER_FILE || name === LAYOUT_SERVER_FILE;
				if (file !== hooksFile && !(file.startsWith(routesDir + sep) && serverRouteFile)) return;
				// a `layout.server.ts` is the one routing file warned about for what it
				// says rather than for existing, so an edit is what turns that warning
				// on and off and only a rescan notices. `regenerate` reloads too.
				if (name === LAYOUT_SERVER_FILE && file.startsWith(routesDir + sep)) {
					regenerate();
					return;
				}
				server.ws.send({ type: "full-reload" });
			};

			// A route's `SOCKET` handler is served in dev the same way it is in
			// production: the app's pipeline decides, and a path no socket route
			// claims is left alone — Vite's own HMR channel is on this server too.
			server.httpServer?.on("upgrade", (req, socket, head) => {
				handleUpgrade({ server, req, socket, head, entry: ENTRY_SERVER, routes }).catch(
					(error: unknown) => {
						server.config.logger.error(
							taggedWarning(
								`websocket upgrade failed: ${error instanceof Error ? error.message : String(error)}`,
							),
						);
						socket.destroy();
					},
				);
			});

			server.watcher.on("add", onFile);
			server.watcher.on("unlink", onFile);
			server.watcher.on("unlinkDir", onDir);
			server.watcher.on("add", onEnvFile);
			server.watcher.on("change", onEnvFile);
			server.watcher.on("unlink", onEnvFile);
			server.watcher.on("change", onServerFile);

			// a returned hook runs after Vite's own middlewares are installed, so
			// assets, source modules, and `static/` are served before the app's
			// pipeline sees a request — the order a deployed kit app has too
			return () => {
				// `output` is a file the build writes; in dev it is stale or absent,
				// so its URL is answered from the routes as they are right now. The
				// live `path`, when there is one, is a real endpoint and needs
				// nothing here.
				const documentUrl = openApiPublicUrl();
				if (documentUrl !== null) {
					server.middlewares.use((req, res, next) => {
						if (new URL(req.url ?? "/", "http://localhost").pathname !== documentUrl) {
							return next();
						}
						openApiJson(
							(id) => server.ssrLoadModule(id) as Promise<Record<string, unknown>>,
							(message) => {
								server.config.logger.warn(message);
							},
						).then((json) => {
							res.setHeader("content-type", "application/json; charset=utf-8");
							res.end(json);
						}, next);
					});
				}
				server.middlewares.use((req, res, next) => {
					if (res.writableEnded) return next();
					handleServerRequest({
						server,
						req,
						res,
						entry: ENTRY_SERVER,
						shell: shell?.path ?? null,
						routes,
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
			// dynamic imports count: routes are code-split, so `$implement/router`
			// reaches every page through `import()` and a chain that skipped those
			// would stop at the page instead of reporting the entry it hangs off
			for (const imported of [...info.importedIds, ...info.dynamicallyImportedIds]) {
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
				!looksServerOnly(source) ||
				serverKind(importer) !== null ||
				!isClientGraph(this.environment)
			) {
				return null;
			}
			const resolved = await this.resolve(source, importer, { skipSelf: true });
			const kind = resolved === null ? null : serverKind(resolved.id);
			if (resolved === null || kind === null) return null;
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
			/**
			 * How a link in the chain reached the one below it. Read off the file and
			 * confirmed by resolution — a specifier only counts once it resolves to the
			 * module it is claimed to reach — so the message can name the single import
			 * to delete rather than leaving a chain of file names to bisect by hand.
			 * Virtual modules like `$implement/router` have no file to read, and stay bare.
			 */
			const site: ImportSiteLookup = async (parent, child) => {
				let code: string;
				try {
					code = await readFile(withoutQuery(parent), "utf8");
				} catch {
					return undefined;
				}
				const target = withoutQuery(child);
				// the likely one first, so the usual case costs a single resolution
				const candidates = scanImports(code).toSorted(
					(a, b) => Number(sameStem(b.source, target)) - Number(sameStem(a.source, target)),
				);
				for (const candidate of candidates) {
					const hit = await this.resolve(candidate.source, parent, { skipSelf: true }).catch(
						() => null,
					);
					if (hit !== null && withoutQuery(hit.id) === target) return candidate;
				}
				return undefined;
			};
			return this.error(
				serverImportError({
					server: resolved.id,
					kind,
					importer,
					source,
					chain: await chainLinks(importer, importerChain(importer, importers), site),
					root,
				}),
			);
		},
	};

	/**
	 * `./$types` as a module, not just a declaration. The generated `.d.ts` for
	 * an endpoint directory exports a `handler` bound to that route's params;
	 * this is where that export comes from at runtime — the same two lines for
	 * every route, since params are purely type-level.
	 *
	 * `enforce: "pre"` for the reason the guard has it: `vite:alias` resolves
	 * and short-circuits ahead of a normally-ordered `resolveId`.
	 */
	const typesPlugin: Plugin = {
		name: "implement-kit-types",
		enforce: "pre",
		resolveId(source, importer) {
			if (source !== "./$types" || importer === undefined) return null;
			const file = normalizeFile(withoutQuery(importer));
			return file.startsWith(`${normalizeFile(routesDir)}/`) ? TYPES_ID : null;
		},
		load(id) {
			return id === TYPES_ID ? TYPES_MODULE : null;
		},
	};

	return [
		guardPlugin,
		typesPlugin,
		kitPlugin,
		shellOutputPlugin(),
		implement({
			entry: ENTRY_SERVER,
			// kit serves dev pages itself, through the request pipeline
			devSsr: false,
			prerender: options.prerender === false ? false : prerenderConfig,
			// the document does not come from the prerender, so it is not written
			// from it: a `prerender: false` app — the normal shape for one whose
			// pages sit behind a session — gets its `output` file all the same
			build: openapi === undefined ? undefined : ({ load, outDir }) => writeOpenApi(load, outDir),
			finish:
				adapter === undefined
					? undefined
					: async ({ routes: prerendered, outDir: clientDir }) => {
							await runAdapter({
								adapter,
								config: resolvedConfig!,
								clientDir,
								entryServer: ENTRY_SERVER,
								tree: tree ?? scan(),
								routesBase,
								pages: prerendered,
								files: [...openApiFiles, ...prerenderedFiles],
								extraEndpoints: openapi?.path === undefined ? [] : [openapi.path],
							});
						},
		}),
	];
}
