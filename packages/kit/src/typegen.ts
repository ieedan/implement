import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
	clientTypeReference,
	dataChains,
	generateClientModule,
	matcherTypeExpr,
	pageRoutes,
	type ClientStyle,
	type DataChain,
	type PageRoute,
} from "./codegen.ts";
import { type RouteNode, type RouteParam, type RouteTree } from "./scan.ts";

export const IMPLEMENT_DIR = ".implement";

/** Where param matchers live, relative to the app root. */
export const DEFAULT_PARAMS_DIR = "src/params";

const ENTRY_CLIENT = `import { App } from "@implementjs/core";
import { installHydration } from "@implementjs/core/hydrate";
import { initClientData, preloadRoute } from "@implementjs/kit/runtime";
import { router } from "$implement/router";

// Kit apps are server-rendered, so the mount adopts that markup instead of
// rebuilding it. Hydration is opt-in precisely so client-only apps — which
// never reach this entry — do not carry the claim machinery.
installHydration();

initClientData();

const app = App({ target: document.body });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

// The landing route's page and layouts are in chunks of their own, and the
// router renders them synchronously, so they have to be in memory first.
// Deliberately not a top-level await: Rollup hoists what the route chunks
// share into this entry's chunk, so those chunks statically import it —
// waiting here for an import that is waiting for this module deadlocks both.
preloadRoute(window.location.pathname).then(
	() => app.render(router),
	(error) => {
		// the server-rendered markup is already on screen; leaving a readable
		// page up beats tearing it down for a route whose code never arrived
		console.error(error);
	},
);
`;

/**
 * The generated server entry: the app's request pipeline. `render` is what the
 * prerenderer calls; `respond` is what the dev server calls. Both run the
 * app's `src/hooks.server.ts` around the page, endpoint, or route-data
 * response.
 */
function entryServer(hasErrorPage: boolean): string {
	const renderPage = hasErrorPage
		? [
				"		return renderToString(error === null ? router : errorPage(error), {",
				"			location: url.pathname + url.search,",
				"		});",
			]
		: [
				"		// without a root error.ts there is no error page to render",
				"		if (error !== null) return null;",
				"		return renderToString(router, { location: url.pathname + url.search });",
			];
	return `${[
		'import { renderToString } from "@implementjs/core/server";',
		'import { preloadRoute, seedData } from "@implementjs/kit/runtime";',
		'import { createKitServer } from "@implementjs/kit/server";',
		'import * as hooks from "$implement/hooks";',
		'import { createClient } from "$implement/client";',
		'import { endpoints } from "$implement/endpoints";',
		'import { matchers } from "$implement/params";',
		'import { pages } from "$implement/pages";',
		`import { ${hasErrorPage ? "errorPage, router" : "router"} } from "$implement/router";`,
		"",
		'export type { RenderResult } from "@implementjs/kit/server";',
		"",
		"const server = createKitServer({",
		"	hooks,",
		"	pages,",
		"	endpoints,",
		"	// so a `[param=<name>]` route only serves what its matcher accepts",
		"	matchers,",
		"	// so `event.api` is this app's own client, bound to `event.fetch`",
		"	createApiClient: createClient,",
		"	renderPage: async ({ url, data, error }) => {",
		"		if (data !== null) seedData(data);",
		"		// renderToString walks the tree synchronously, so the route's own",
		"		// chunks have to be loaded first. The error page is not split, so",
		"		// an error render has nothing to wait for.",
		"		if (error === null) await preloadRoute(url.pathname);",
		...renderPage,
		"	},",
		"});",
		"",
		"export const render = server.render;",
		"export const respond = server.respond;",
	].join("\n")}\n`;
}

/** Aliases every kit app gets; \`KitOptions.alias\` entries merge over them. */
export const DEFAULT_ALIASES: Record<string, string> = { "@/lib": "src/lib" };

/** The router package kit generates against. See {@link routerAliases}. */
export const ROUTER_PACKAGE = "@implementjs/router";

const requireFromKit = createRequire(import.meta.url);

/**
 * The alias pointing \`@implementjs/router\` at the copy kit generated against.
 *
 * Nothing an app writes imports the router — the generated \`$implement/router\`
 * module does, and \`$implement-params.d.ts\` augments its \`ParamTypes\`. Both sit
 * inside the app, which is not where the package is: kit depends on it, so a
 * pnpm install leaves it under kit rather than anywhere the app resolves from.
 *
 * An app could depend on it too, and until now the scaffold did. But that is a
 * version the app can drift off kit's, and drift here is quiet in both
 * directions: a second copy in the graph is a second \`ParamTypes\` registry, and
 * the \`href\` that reads the first one never sees what the app declared into the
 * second. Resolving it here instead makes the app's router kit's router by
 * construction, and takes the line out of the app's \`package.json\` entirely.
 *
 * The declaration entry is read off the package rather than guessed from the
 * runtime one: they are the same \`src/index.ts\` in this workspace, and
 * \`dist/index.mjs\` beside \`dist/index.d.mts\` in a published install.
 *
 * Empty when the package will not resolve — under Yarn PnP there is no tree to
 * point at, and an app that installed the router itself needs no help anyway.
 * The alias is what makes the dependency unnecessary, not what makes kit work.
 */
export function routerAliases(): {
	vite: Record<string, string>;
	tsconfig: Record<string, string>;
} {
	let runtime: string;
	try {
		runtime = requireFromKit.resolve(ROUTER_PACKAGE);
	} catch {
		return { vite: {}, tsconfig: {} };
	}
	return {
		vite: { [ROUTER_PACKAGE]: runtime },
		tsconfig: { [ROUTER_PACKAGE]: routerTypesEntry(runtime) ?? runtime },
	};
}

/**
 * The router's declaration entry, read off the \`package.json\` its runtime entry
 * sits under. Walked up to rather than resolved: the package exports only
 * \`"."\`, so \`require.resolve("@implementjs/router/package.json")\` is refused.
 */
function routerTypesEntry(runtime: string): string | null {
	let dir = dirname(runtime);
	for (;;) {
		const manifest = join(dir, "package.json");
		if (existsSync(manifest)) {
			const types = readTypesCondition(manifest);
			return types === null ? null : resolve(dir, types);
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** \`exports["."].types\` from a manifest, or \`null\` if it does not declare one. */
function readTypesCondition(manifest: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(manifest, "utf8"));
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null || !("exports" in parsed)) return null;
	const exports = parsed.exports;
	if (typeof exports !== "object" || exports === null || !("." in exports)) return null;
	const root = exports["."];
	if (typeof root !== "object" || root === null || !("types" in root)) return null;
	return typeof root.types === "string" ? root.types : null;
}

/**
 * The tsconfig apps extend. rootDirs merges the app root with the generated
 * types dir, so route files resolve \`./$types\`; paths mirrors the aliases
 * the plugin sets up in Vite (relative paths in an extended config resolve
 * against this file, so root-relative targets get a \`../\` prefix).
 */
export function generateTsconfig(aliases: Record<string, string>): string {
	// the generated client is a real file beside this config, so TypeScript
	// resolves `$implement/client` to it and reads the app's own route table
	const paths: Record<string, string[]> = { "$implement/client": ["./client.ts"] };
	for (const [name, target] of Object.entries(aliases)) {
		const normalized = target.replaceAll("\\", "/").replace(/\/+$/, "");
		const base = isAbsolute(normalized) ? normalized : `../${normalized}`;
		paths[name] = [base];
		// a target ending in a file extension aliases one module, not a tree
		if (!/\.[^/]+$/.test(base)) paths[`${name}/*`] = [`${base}/*`];
	}
	const tsconfig = {
		compilerOptions: { rootDirs: ["..", "./types"], paths },
		include: ["./types/**/*.d.ts", "./*.ts", "../src/**/*"],
	};
	return `${JSON.stringify(tsconfig, null, "\t")}\n`;
}

/**
 * `{ "id": Readable<number> }` — what a page or layout receives. A matched
 * param carries what its matcher makes of the segment, read off the matcher
 * module's own type.
 */
function paramsType(params: RouteParam[], paramsSpecifier: string): string {
	if (params.length === 0) return "{}";
	const entries = params.map(
		(param) =>
			`${JSON.stringify(param.name)}: Readable<${matcherTypeExpr(param, paramsSpecifier)}>`,
	);
	return `{ ${entries.join("; ")} }`;
}

/** The same, as `event.params` carries it: the value itself, not a readable. */
function serverParamsType(params: RouteParam[], paramsSpecifier: string): string {
	if (params.length === 0) return "{}";
	const entries = params.map(
		(param) => `${JSON.stringify(param.name)}: ${matcherTypeExpr(param, paramsSpecifier)}`,
	);
	return `{ ${entries.join("; ")} }`;
}

/** The relative specifier resolving a routes-relative file from a route directory's \`$types\`. */
function relativeImport(dir: string, file: string): string {
	const up = dir === "" ? 0 : dir.split("/").length;
	return up === 0 ? `./${file}` : `${"../".repeat(up)}${file}`;
}

/** Where the two generated directories sit, relative to the app root. */
export type GenPaths = {
	/** Routes directory (`src/routes`), forward slashes, no leading one. */
	routes: string;
	/** Param matchers directory (`src/params`), forward slashes, no leading one. */
	params: string;
};

/**
 * The params directory as a route directory's \`$types\` reaches it. The
 * generated types resolve through the tsconfig's \`rootDirs\`, so a \`$types.d.ts\`
 * addresses the app as if it sat in the route directory itself.
 */
function paramsSpecifier(paths: GenPaths, dir: string, extra = 0): string {
	const up = paths.routes.split("/").length + (dir === "" ? 0 : dir.split("/").length) + extra;
	return `${"../".repeat(up)}${paths.params}`;
}

/** \`Merge<Merge<{}, LoadData<...>>, LoadData<...>>\` over a route's server files. */
function dataType(dir: string, files: string[]): string {
	let expr = "{}";
	for (const file of files) {
		const specifier = JSON.stringify(relativeImport(dir, file));
		expr = `Merge<${expr}, LoadData<typeof import(${specifier}).default>>`;
	}
	return expr;
}

/**
 * The \`handler\` a route's \`./$types\` exports, bound to that directory's params.
 * Only endpoint directories get it: a directory serves a page or an endpoint,
 * never both, so a page's \`$types\` has no value export at all and nothing can
 * drag server code into the client bundle through it.
 */
const HANDLER_EXPORT = `
export const handler: HandlerBuilder<ServerParams>;
export { json } from "@implementjs/kit/endpoint";
`;

const HANDLER_IMPORT = `import type { HandlerBuilder } from "@implementjs/kit/endpoint";
`;

/** The \`./$types\` module for one route directory. */
export function generateRouteTypes(node: RouteNode, chain: DataChain, paths: GenPaths): string {
	const params = paramsSpecifier(paths, node.dir);
	const helpers =
		chain.layoutFiles.length === 0 && chain.pageFiles.length === 0
			? ""
			: `
type Merge<A, B> = Omit<A, keyof B> & B;
type LoadData<T> = T extends (...args: never) => infer R
	? Awaited<R> extends object
		? Awaited<R>
		: {}
	: {};
`;
	return `import type { Mountable, Readable, RouterLocation } from "@implementjs/core";
import type { RouterError } from "@implementjs/router";
${node.endpoint === null ? "" : HANDLER_IMPORT}import type { RequestEvent as KitRequestEvent } from "@implementjs/kit/server";
${helpers}
export type RouteParams = ${paramsType(node.params, params)};
export type ServerParams = ${serverParamsType(node.params, params)};
export type LoadEvent = KitRequestEvent<ServerParams>;
export type RequestEvent = KitRequestEvent<ServerParams>;
export type LayoutData = ${dataType(node.dir, chain.layoutFiles)};
export type PageData = ${dataType(node.dir, chain.pageFiles)};
export type PageProps = { params: RouteParams; url: Readable<RouterLocation>; data: Readable<PageData> };
export type LayoutProps = { children: Mountable; params: RouteParams; url: Readable<RouterLocation>; data: Readable<LayoutData> };
export type ErrorProps = { error: RouterError; url: Readable<RouterLocation> };
${node.endpoint === null ? "" : HANDLER_EXPORT}`;
}

/** The \`./$types\` module for a \`.<ext>\` extension-endpoint directory. */
export function generateExtensionTypes(node: RouteNode, paths: GenPaths): string {
	// one level deeper than the route directory: the `.md/` the endpoint sits in
	const params = paramsSpecifier(paths, node.dir, 1);
	return `${HANDLER_IMPORT}import type { RequestEvent as KitRequestEvent } from "@implementjs/kit/server";

export type ServerParams = ${serverParamsType(node.params, params)};
export type RequestEvent = KitRequestEvent<ServerParams>;
${HANDLER_EXPORT}`;
}

/**
 * The ambient declarations typing the \`$implement/*\` virtual modules.
 *
 * This file sits at \`.implement/types/\`, which the tsconfig's \`rootDirs\` merges
 * with the app root — so \`./src/params/integer.ts\` addresses the app's matcher
 * from here the same way a route's \`$types\` addresses it from its own directory.
 *
 * It has to stay a *script* — no top-level \`import\` or \`export\`. \`$implement/*\`
 * has no file behind it, so each block here has to be an ambient module
 * declaration, and \`declare namespace App\` only merges globally from a script.
 * That is also why the \`ParamTypes\` augmentation cannot live here: see
 * {@link generateParamTypesDeclaration}.
 */
export function generateRouterDeclaration(
	routes: PageRoute[],
	hasErrorPage: boolean,
	paths: GenPaths,
	client: ClientStyle = {},
): string {
	const params = `./${paths.params}`;
	const entries = routes
		.map(
			(route) =>
				`\t\t${JSON.stringify(route.pattern)}: (params: ${paramsType(route.params, params)}) => Child;`,
		)
		.join("\n");
	const errorPage = hasErrorPage
		? `\n\n\texport function errorPage(error: RouterError): Child;`
		: "";
	return `declare module "$implement/router" {
	import type { Child, Readable } from "@implementjs/core";
	import type { RouterError, RouterHelper } from "@implementjs/router";

	export const router: RouterHelper<{
${entries}
	}>;${errorPage}
}

declare module "$implement/params" {
	import type { ParamMatchers } from "@implementjs/kit/params";

	/** The app's \`${paths.params}/*.ts\` matchers, keyed by filename. */
	export const matchers: ParamMatchers;
}

declare module "$implement/pages" {
	import type { PageRoute } from "@implementjs/kit/server";

	export const pages: PageRoute[];
}

declare module "$implement/endpoints" {
	import type { EndpointRoute } from "@implementjs/kit/server";

	export const endpoints: EndpointRoute[];
}

declare module "$implement/hooks" {
	import type { Handle, HandleServerError, ServerInit } from "@implementjs/kit/server";

	export const handle: Handle | undefined;
	export const handleError: HandleServerError | undefined;
	export const init: ServerInit | undefined;
}

declare namespace App {
	/**
	 * The client over this app's own routes, as \`api.client\` shapes it.
	 *
	 * It is named before it is extended because an interface may only extend a
	 * name — extending an inline \`import(…)\` type is \`TS2499\`. An app compiling
	 * its generated types with \`skipLibCheck\` never sees that error, and is
	 * simply left with an \`Api\` that has nothing on it.
	 */
	type GeneratedApi = ${clientTypeReference(client, 'import("../client.ts").Api')};

	/**
	 * \`event.api\` — the client over this app's own routes, bound to
	 * \`event.fetch\`. Merged into the empty \`interface Api\` kit declares, the
	 * same way an app's \`src/app.d.ts\` fills in \`Locals\`.
	 */
	interface Api extends GeneratedApi {}
}
`;
}

/**
 * The app's matchers, declared to \`@implementjs/router\`'s \`ParamTypes\` registry.
 *
 * The router does the client-side matching, and its \`:param=<name>\` keys are
 * strings — so what a matcher *produces* reaches the router's own types through
 * the registry the package declares for exactly this: the params a route
 * factory is called with, and what \`href\`, \`navigate\`, and \`Link\` take for
 * that segment.
 *
 * This is a file of its own, and it is deliberate. Filling in an interface from
 * a real package is a *module augmentation*, which only happens inside a
 * module; in a script, \`declare module "@implementjs/router"\` declares an
 * ambient module that **takes the name over** instead. That is not an error
 * anywhere — the package's own exports simply stop existing, so \`RouterHelper\`
 * resolves to nothing and \`$implement/router\`'s \`router\` collapses to \`any\`,
 * along with every \`Link\`, \`Router\`, and \`RouterError\` the app imports. The
 * two cannot share a file either: \`$implement.d.ts\` has to be a script for its
 * own sake (see {@link generateRouterDeclaration}), and an augmentation of
 * \`$implement/router\` — a name with no file behind it — is \`TS2664\`.
 *
 * So: \`import type {}\` makes this one a module, and nothing else goes in it.
 */
export function generateParamTypesDeclaration(matchers: string[], paths: GenPaths): string {
	const entries = matchers
		.map(
			(name) =>
				`\t\t${JSON.stringify(name)}: import("@implementjs/kit/params").ParamType<typeof import(${JSON.stringify(`./${paths.params}/${name}.ts`)}).default>;`,
		)
		.join("\n");
	return `import type {} from "@implementjs/router";

declare module "@implementjs/router" {
	interface ParamTypes {
${entries}
	}
}
`;
}

/**
 * The base \`App\` namespace, so \`App.Locals\` resolves in an app that has not
 * written a \`src/app.d.ts\` yet. An app's own declarations merge into these.
 */
export function generateAppDeclaration(): string {
	return `declare global {
	namespace App {
		/** Per-request state \`src/hooks.server.ts\` sets and routes read. */
		interface Locals {}
		/** The shape \`handleError\` returns and the error page receives. */
		interface Error {
			message: string;
		}
		/** The generated client on \`event.api\`, filled in by \`$implement.d.ts\`. */
		interface Api {}
	}
}

export {};
`;
}

export type SyncOptions = {
	/** Routes directory relative to the app root. @default "src/routes" */
	routes?: string;
	/** Param matchers directory relative to the app root. @default "src/params" */
	params?: string;
	/** How the generated \`.implement/client.ts\` is shaped — \`KitOptions.api.client\`. */
	client?: ClientStyle;
	/** Extra aliases (name → path relative to the app root) for the generated tsconfig, on top of `@/lib` → `src/lib`. */
	alias?: Record<string, string>;
};

/**
 * `neverthrow` is an optional peer, so an app can pick the error style that
 * needs it without having it — and the way that fails is the worst kind of
 * quiet. The generated `.implement/client.ts` imports
 * `@implementjs/kit/client/neverthrow`, whose own `import … from "neverthrow"`
 * resolves to nothing: `Api` never resolves, `event.api` and `$implement/client`
 * fall back to `any`, and the only sign of it is a `Cannot find module
 * "neverthrow"` from `tsc` pointing inside a generated file nobody wrote. So
 * codegen refuses instead — the option is read here, and here is where saying
 * so is useful.
 */
export function assertClientDependencies(root: string, client: ClientStyle): void {
	if (client.errors !== "neverthrow") return;
	if (isInstalled(root, "neverthrow")) return;
	throw new Error(
		[
			'api.client.errors is "neverthrow", but the `neverthrow` package is not installed.',
			"It is an optional peer dependency of @implementjs/kit — the error style that needs it is the only thing that pulls it in.",
			'Install it (`npm i neverthrow`), or pick "result" or "throw" instead.',
		].join("\n"),
	);
}

/**
 * Whether a package is installed anywhere node would look for it from the app.
 * Walked rather than `require.resolve`d: this asks about the app's tree, not
 * about the process doing the asking, and the answer has to be the same from a
 * dev server, a build, and the `sync` CLI. Yarn PnP has no tree to walk and
 * resolves through its loader instead, so there the question is not ours to
 * answer.
 */
function isInstalled(root: string, name: string): boolean {
	if (process.versions["pnp"] !== undefined) return true;
	let dir = resolve(root);
	for (;;) {
		if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
		const parent = dirname(dir);
		if (parent === dir) return false;
		dir = parent;
	}
}

/**
 * Writes the generated \`.implement/\` directory for an app: virtual-entry
 * files, the tsconfig apps extend, and per-route \`./$types\` declarations.
 * Idempotent — files are only rewritten when their content changed, and
 * stale \`$types\` files from removed routes are pruned.
 */
export function writeGenerated(root: string, tree: RouteTree, options: SyncOptions = {}): void {
	assertClientDependencies(root, options.client ?? {});
	const routesDir = options.routes ?? "src/routes";
	const paths: GenPaths = {
		routes: normalizeDir(routesDir),
		params: normalizeDir(options.params ?? DEFAULT_PARAMS_DIR),
	};
	const outDir = join(root, IMPLEMENT_DIR);
	const typesDir = join(outDir, "types");
	mkdirSync(typesDir, { recursive: true });

	writeIfChanged(join(outDir, ".gitignore"), "*\n");
	writeIfChanged(join(outDir, "entry-client.ts"), ENTRY_CLIENT);
	writeIfChanged(join(outDir, "entry-server.ts"), entryServer(tree.error !== null));
	writeIfChanged(
		join(outDir, "tsconfig.json"),
		generateTsconfig({ ...DEFAULT_ALIASES, ...routerAliases().tsconfig, ...options.alias }),
	);
	writeIfChanged(
		join(outDir, "client.ts"),
		generateClientModule(tree, `/${paths.routes}`, `/${paths.params}`, options.client ?? {}),
	);
	writeIfChanged(
		join(typesDir, "$implement.d.ts"),
		generateRouterDeclaration(pageRoutes(tree), tree.error !== null, paths, options.client ?? {}),
	);
	// its own file because it is a module and `$implement.d.ts` is a script — and
	// removed rather than emptied, since what is left of it once the last matcher
	// goes is a module augmentation of an interface with nothing to add
	const paramTypesFile = join(typesDir, "$implement-params.d.ts");
	if (tree.matchers.length === 0) rmSync(paramTypesFile, { force: true });
	else writeIfChanged(paramTypesFile, generateParamTypesDeclaration(tree.matchers, paths));
	writeIfChanged(join(typesDir, "app.d.ts"), generateAppDeclaration());

	const chains = dataChains(tree);
	const expected = new Set<string>();
	const write = (target: string, content: string) => {
		expected.add(target);
		mkdirSync(dirname(target), { recursive: true });
		writeIfChanged(target, content);
	};
	const emit = (node: RouteNode) => {
		if (
			node.page !== null ||
			node.layout !== null ||
			node.layoutServer !== null ||
			node.endpoint !== null
		) {
			write(
				join(typesDir, routesDir, node.dir, "$types.d.ts"),
				generateRouteTypes(node, chains.get(node)!, paths),
			);
		}
		for (const extension of node.extensions) {
			write(
				join(typesDir, routesDir, node.dir, extension.extension, "$types.d.ts"),
				generateExtensionTypes(node, paths),
			);
		}
		for (const child of node.children) emit(child);
	};
	emit(tree.root);
	// error.ts imports the root ./$types too
	if (tree.error !== null && !expected.has(join(typesDir, routesDir, "$types.d.ts"))) {
		write(
			join(typesDir, routesDir, "$types.d.ts"),
			generateRouteTypes(tree.root, chains.get(tree.root)!, paths),
		);
	}
	pruneStaleTypes(join(typesDir, routesDir), expected);
}

/** A configured directory as the generated files name it: forward slashes, no edge slashes. */
function normalizeDir(dir: string): string {
	return dir.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function writeIfChanged(file: string, content: string): void {
	if (existsSync(file) && readFileSync(file, "utf8") === content) return;
	writeFileSync(file, content);
}

function pruneStaleTypes(dir: string, expected: Set<string>): void {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			pruneStaleTypes(path, expected);
			if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
		} else if (entry.name === "$types.d.ts" && !expected.has(path)) {
			rmSync(path);
		}
	}
}
