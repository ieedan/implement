import { routeId } from "./match.ts";
import type { OpenApiRouteOptions } from "./openapi.ts";
import { segmentKey, type RouteNode, type RouteSegment, type RouteTree } from "./scan.ts";

export type DataChain = {
	/** Server files (root first) feeding this directory's layout `data`. */
	layoutFiles: string[];
	/** Server files (root first) feeding this directory's page `data`. */
	pageFiles: string[];
};

/** The layout chains behind one directory, root first, `@` resets applied. */
type NodeChain = {
	/** The nodes whose layouts wrap this directory, this directory last. */
	layout: RouteNode[];
	/** The nodes whose layouts wrap this directory's page, its own reset applied. */
	page: RouteNode[];
};

function layoutServerFiles(chain: RouteNode[]): string[] {
	return chain.flatMap((entry) => (entry.layoutServer === null ? [] : [entry.layoutServer]));
}

/**
 * Which ancestors actually wrap each directory, `@` resets applied. One answer
 * settles two questions that must never disagree: which layout components
 * render around a page, and which ancestor `layout.server.ts` loads feed its
 * `data` — a reset that skips a layout skips that layout's load too.
 */
function nodeChains(tree: RouteTree): Map<RouteNode, NodeChain> {
	const parents = new Map<RouteNode, RouteNode | null>();
	const linkParents = (node: RouteNode, parent: RouteNode | null) => {
		parents.set(node, parent);
		for (const child of node.children) linkParents(child, node);
	};
	linkParents(tree.root, null);

	const rawChain = (node: RouteNode): RouteNode[] => {
		const chain: RouteNode[] = [];
		for (let cursor: RouteNode | null = node; cursor !== null; cursor = parents.get(cursor)!) {
			chain.unshift(cursor);
		}
		return chain;
	};

	const effective = new Map<RouteNode, RouteNode[]>();
	const effectiveChain = (node: RouteNode): RouteNode[] => {
		const cached = effective.get(node);
		if (cached !== undefined) return cached;
		const parent = parents.get(node) ?? null;
		let chain: RouteNode[];
		if (parent === null) {
			chain = [node];
		} else if (node.layoutResetTo === null) {
			chain = [...effectiveChain(parent), node];
		} else if (node.layoutResetTo === "") {
			chain = [tree.root, node];
		} else {
			const raw = rawChain(node);
			let target: RouteNode | null = null;
			for (let i = raw.length - 2; i >= 1; i--) {
				if (rawName(raw[i]!) === node.layoutResetTo) {
					target = raw[i]!;
					break;
				}
			}
			if (target === null) {
				throw new Error(`No ancestor segment "${node.layoutResetTo}" to reset to`);
			}
			chain = [...effectiveChain(target), node];
		}
		effective.set(node, chain);
		return chain;
	};

	/** The chain wrapping this directory's page, its own `@` reset applied. */
	const pageChain = (node: RouteNode): RouteNode[] => {
		if (node.pageResetTo === null) return effectiveChain(node);
		if (node.pageResetTo === "") return [tree.root];
		const raw = rawChain(node);
		// a page may reset to its own directory, keeping that directory's layout
		for (let i = raw.length - 1; i >= 1; i--) {
			if (rawName(raw[i]!) === node.pageResetTo) return effectiveChain(raw[i]!);
		}
		throw new Error(`No ancestor segment "${node.pageResetTo}" to reset to`);
	};

	const chains = new Map<RouteNode, NodeChain>();
	const walk = (node: RouteNode) => {
		chains.set(node, { layout: effectiveChain(node), page: pageChain(node) });
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return chains;
}

/**
 * The server-load files that feed each directory's layout and page `data`,
 * resets applied: the chain follows the layouts that actually wrap the
 * render, so an `@` reset also resets which ancestor loads contribute.
 */
export function dataChains(tree: RouteTree): Map<RouteNode, DataChain> {
	const chains = new Map<RouteNode, DataChain>();
	for (const [node, chain] of nodeChains(tree)) {
		chains.set(node, {
			layoutFiles: layoutServerFiles(chain.layout),
			pageFiles: [
				...layoutServerFiles(chain.page),
				...(node.pageServer === null ? [] : [node.pageServer]),
			],
		});
	}
	return chains;
}

/**
 * Every page pattern with the server files feeding its `data`, root first —
 * the chain the prerender asks about a route's `prerender` flag, and the same
 * one the router module builds its data manifest from.
 */
export function pageDataChains(tree: RouteTree): { pattern: string; files: string[] }[] {
	const chains = dataChains(tree);
	return [...pagePatterns(tree).entries()].map(([node, pattern]) => ({
		pattern,
		files: chains.get(node)!.pageFiles,
	}));
}

export type RouteModules = {
	/** Full path pattern, `:param`/`:...rest` style (`/docs/:...slug`). */
	pattern: string;
	/** Routes-relative component files, wrapping layouts first, the page last. */
	files: string[];
};

/**
 * Every page with the component files that render it — the layouts actually
 * wrapping it (`@` resets applied) and the page itself. This is the preload
 * list: what has to be in memory before the route can render, and what the
 * build's preload hints point the browser at.
 */
export function routeModules(tree: RouteTree): RouteModules[] {
	const chains = nodeChains(tree);
	return [...pagePatterns(tree).entries()].map(([node, pattern]) => ({
		pattern,
		files: [
			...chains.get(node)!.page.flatMap((entry) => (entry.layout === null ? [] : [entry.layout])),
			node.page!,
		],
	}));
}

/**
 * The build-manifest key for a route file. Vite keys `build.manifest` by
 * root-relative path with no leading slash, and the lazy registry uses the
 * same id, so the preload-hint pass can look one up from the other.
 */
export function routeModuleId(routesBase: string, file: string): string {
	return `${routesBase}/${file}`.replace(/^\//, "");
}

/** Every page node with its full path pattern. `(group)` segments contribute nothing. */
function pagePatterns(tree: RouteTree): Map<RouteNode, string> {
	const patterns = new Map<RouteNode, string>();
	const walk = (node: RouteNode, prefix: string) => {
		if (node.page !== null) patterns.set(node, prefix === "" ? "/" : prefix);
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(tree.root, "");
	return patterns;
}

/**
 * Pathless key segment marking a hoisted `page@` page, so it never collides
 * with the key of a directory emitted at the same level. The core router drops
 * `(…)` segments when matching.
 */
const RESET_MARKER = "(@reset)";

/**
 * The router-tree key for a segment. Unlike {@link segmentKey}, `(group)`
 * segments keep a `/(name)` part — the core router ignores it for matching,
 * while it keeps sibling keys unique and scopes the group's layout.
 */
function routerKey(segment: RouteSegment): string {
	if (segment.kind === "group") return `/(${segment.name})`;
	return segmentKey(segment);
}

const rawName = (node: RouteNode): string => node.dir.split("/").pop()!;

const routeDataExpr = (files: string[]): string => `routeData(${JSON.stringify(files)})`;

/**
 * The source of the `$implement/router` virtual module: declares a lazy handle
 * per page and layout, adapts them onto `@implementjs/core`'s `Router` tree,
 * and exports the router. Pages render as `Page.get()({ params, url, data })`,
 * layouts as `Layout.get()({ children, params, url, data })`, and a root
 * `error.ts` becomes the router fallback, rendered as
 * `ErrorPage({ error, url })`. `data` is a readable merging what the route's
 * `*.server.ts` loads returned (empty when the route has none); routes with
 * loads are also registered with the client runtime so navigation fetches
 * their data before committing.
 *
 * Every page and layout is behind a `lazyModule` handle so Rollup splits the
 * app by route: nothing but the entry route's chunks loads up front. The
 * handles are declared, never awaited here — the route factories stay
 * synchronous, and `registerRouteModules` tells the runtime which handles each
 * route needs so the render paths can preload them (see `./lazy.ts`). The root
 * `error.ts` stays a static import: it renders unmatched paths, so it cannot
 * sit behind a route match, and it is small.
 *
 * `@` layout resets are realized by hoisting: a reset page (or a subtree whose
 * layout resets) is emitted at its target ancestor under the full key from
 * there, so only the layouts at and above the target wrap it.
 */
export function generateRouterModule(tree: RouteTree, routesBase: string): string {
	const chains = dataChains(tree);
	const patterns = pagePatterns(tree);
	const manifest = [...patterns.entries()]
		.filter(([node]) => chains.get(node)!.pageFiles.length > 0)
		.map(([node, pattern]) => ({ pattern, files: chains.get(node)!.pageFiles }));
	const modules = routeModules(tree).map((route) => ({
		pattern: route.pattern,
		modules: route.files.map((file) => routeModuleId(routesBase, file)),
	}));
	const imports: string[] = ['import { Router } from "@implementjs/core";'];
	const declarations: string[] = [];
	const names = new Map<string, string>();
	let counter = 0;

	const nameFor = (file: string, kind: string): string => `${kind}_${counter++}`;

	/** A page or layout, behind a handle the render paths preload. */
	const lazyFor = (file: string, kind: string): string => {
		let name = names.get(file);
		if (name === undefined) {
			name = nameFor(file, kind);
			names.set(file, name);
			const id = JSON.stringify(routeModuleId(routesBase, file));
			const specifier = JSON.stringify(`${routesBase}/${file}`);
			declarations.push(`const ${name} = lazyModule(${id}, () => import(${specifier}));`);
		}
		return name;
	};

	/** The error fallback, which no route match gates and so cannot be lazy. */
	const importFor = (file: string, kind: string): string => {
		let name = names.get(file);
		if (name === undefined) {
			name = nameFor(file, kind);
			names.set(file, name);
			imports.push(`import ${name} from ${JSON.stringify(`${routesBase}/${file}`)};`);
		}
		return name;
	};

	type Hoist = { key: string; source: RouteNode; kind: "page" | "subtree" };
	const hoists = new Map<RouteNode, Hoist[]>();
	/** Pages emitted at their reset target instead of in their own node. */
	const hoistedPages = new Set<RouteNode>();
	/** Nodes emitted at their layout's reset target instead of under their parent. */
	const detached = new Set<RouteNode>();

	// `chain` is root..current; scan already validated that the target exists
	const targetIndex = (chain: RouteNode[], resetTo: string, includeSelf: boolean): number => {
		if (resetTo === "") return 0;
		for (let i = chain.length - (includeSelf ? 1 : 2); i >= 1; i--) {
			if (rawName(chain[i]!) === resetTo) return i;
		}
		throw new Error(`No ancestor segment "${resetTo}" to reset to`);
	};

	const keyFrom = (chain: RouteNode[], index: number): string =>
		chain
			.slice(index + 1)
			.map((ancestor) => routerKey(ancestor.segment!))
			.join("");

	const plan = (node: RouteNode, chain: RouteNode[]) => {
		if (node.page !== null && node.pageResetTo !== null) {
			const index = targetIndex(chain, node.pageResetTo, true);
			const target = chain[index]!;
			const key = `${keyFrom(chain, index)}/${RESET_MARKER}`;
			hoists.set(target, [...(hoists.get(target) ?? []), { key, source: node, kind: "page" }]);
			hoistedPages.add(node);
		}
		if (node.layoutResetTo !== null) {
			const index = targetIndex(chain, node.layoutResetTo, false);
			const target = chain[index]!;
			const key = keyFrom(chain, index);
			hoists.set(target, [...(hoists.get(target) ?? []), { key, source: node, kind: "subtree" }]);
			detached.add(node);
		}
		for (const child of node.children) plan(child, [...chain, child]);
	};
	plan(tree.root, [tree.root]);

	const pageExpr = (node: RouteNode): string => {
		const name = lazyFor(node.page!, "Page");
		const data = routeDataExpr(chains.get(node)!.pageFiles);
		return `(params) => ${name}.get()({ params, url: router.location, data: ${data} })`;
	};

	const nodeExpr = (node: RouteNode, indent: string): string => {
		const inner = `${indent}\t`;
		const entries: string[] = [];
		if (node.layout !== null) {
			const name = lazyFor(node.layout, "Layout");
			const data = routeDataExpr(chains.get(node)!.layoutFiles);
			entries.push(
				`${inner}layout: (children, params) => ${name}.get()({ children, params, url: router.location, data: ${data} }),`,
			);
		}
		if (node.page !== null && !hoistedPages.has(node)) {
			entries.push(`${inner}"/": ${pageExpr(node)},`);
		}
		for (const child of node.children) {
			if (detached.has(child)) continue;
			const key = JSON.stringify(routerKey(child.segment!));
			entries.push(`${inner}${key}: ${nodeExpr(child, inner)},`);
		}
		for (const hoist of hoists.get(node) ?? []) {
			if (hoist.kind === "page") {
				entries.push(`${inner}${JSON.stringify(hoist.key)}: ${pageExpr(hoist.source)},`);
			} else {
				entries.push(`${inner}${JSON.stringify(hoist.key)}: ${nodeExpr(hoist.source, inner)},`);
			}
		}
		return `{\n${entries.join("\n")}\n${indent}}`;
	};

	const routes = nodeExpr(tree.root, "");
	const errorName = tree.error === null ? null : importFor(tree.error, "ErrorPage");
	const fallback =
		errorName === null
			? ""
			: `, {\n\tfallback: (error) => ${errorName}({ error, url: router.location }),\n}`;

	// only what the module actually uses, so a tree with no pages at all still
	// emits an import list that type-checks and tree-shakes cleanly
	const runtimeImports = [
		...(declarations.length > 0 ? ["lazyModule"] : []),
		...(modules.length > 0 ? ["registerRouteModules"] : []),
		...(manifest.length > 0 ? ["registerRoutes"] : []),
		"routeData",
	];
	imports.splice(1, 0, `import { ${runtimeImports.join(", ")} } from "@implementjs/kit/runtime";`);

	const blocks = [
		imports.join("\n"),
		...(declarations.length > 0 ? [declarations.join("\n")] : []),
		`export const router = Router(${routes}${fallback});`,
		// the server renders the error page on its own for a 404 or a thrown
		// error, where there is no router match to fall back through. It stays a
		// static import for the same reason the fallback does.
		...(errorName === null
			? []
			: [`export const errorPage = (error) => ${errorName}({ error, url: router.location });`]),
		...(modules.length > 0
			? [`registerRouteModules(${JSON.stringify(modules, null, "\t")});`]
			: []),
		...(manifest.length > 0 ? [`registerRoutes(${JSON.stringify(manifest, null, "\t")});`] : []),
	];
	return `${blocks.join("\n\n")}\n`;
}

export type PageRoute = {
	/** Full path pattern, `:param`/`:...rest` style (`/docs/:...slug`). */
	pattern: string;
	/** Param names the pattern binds, root first. */
	params: string[];
};

/** Every page in the tree with its full path pattern. `(group)` segments contribute nothing. */
export function pageRoutes(tree: RouteTree): PageRoute[] {
	const routes: PageRoute[] = [];
	const walk = (node: RouteNode, prefix: string) => {
		if (node.page !== null) {
			routes.push({ pattern: prefix === "" ? "/" : prefix, params: node.params });
		}
		for (const child of node.children) {
			walk(child, `${prefix}${segmentKey(child.segment!)}`);
		}
	};
	walk(tree.root, "");
	return routes;
}

/** The paths of every page without params — the prerenderable set known statically. */
export function staticRoutePaths(tree: RouteTree): string[] {
	return pageRoutes(tree)
		.filter((route) => route.params.length === 0)
		.map((route) => route.pattern);
}

export type ServerRoute = {
	/** Path pattern of the endpoint's directory (`/docs/:...slug`). */
	pattern: string;
	/** The extension a `.<ext>/server.ts` appends to the pattern; `null` for a plain `server.ts`. */
	extension: string | null;
	/** Param names the pattern binds, root first. */
	params: string[];
	/** Relative path of the `server.ts` file. */
	file: string;
};

/** Every `server.ts` endpoint in the tree, extension endpoints included. */
export function serverRoutes(tree: RouteTree): ServerRoute[] {
	const routes: ServerRoute[] = [];
	const walk = (node: RouteNode, prefix: string) => {
		const pattern = prefix === "" ? "/" : prefix;
		if (node.endpoint !== null) {
			routes.push({ pattern, extension: null, params: node.params, file: node.endpoint });
		}
		for (const extension of node.extensions) {
			routes.push({
				pattern,
				extension: extension.extension,
				params: node.params,
				file: extension.file,
			});
		}
		for (const child of node.children) {
			walk(child, `${prefix}${segmentKey(child.segment!)}`);
		}
	};
	walk(tree.root, "");
	return routes;
}

/**
 * The source of the `$implement/pages` virtual module (server-only): every
 * page in the app with its route id and its load chain — the manifest the
 * request pipeline matches against and runs loads from.
 */
export function generatePagesModule(tree: RouteTree, routesBase: string): string {
	const chains = dataChains(tree);
	const patterns = pagePatterns(tree);
	const imports: string[] = [];
	const names = new Map<string, string>();
	const importFor = (file: string): string => {
		let name = names.get(file);
		if (name === undefined) {
			name = `load_${names.size}`;
			names.set(file, name);
			imports.push(`import ${name} from ${JSON.stringify(`${routesBase}/${file}`)};`);
		}
		return name;
	};

	const entries: string[] = [];
	for (const [node, pattern] of patterns) {
		const files = chains.get(node)!.pageFiles;
		const parts = files.map((file) => `{ id: ${JSON.stringify(file)}, load: ${importFor(file)} }`);
		entries.push(
			`\t{ pattern: ${JSON.stringify(pattern)}, id: ${JSON.stringify(routeId(pattern))}, files: [${parts.join(", ")}] },`,
		);
	}

	const header = imports.length === 0 ? "" : `${imports.join("\n")}\n\n`;
	const body = entries.length === 0 ? "[]" : `[\n${entries.join("\n")}\n]`;
	return `${header}export const pages = ${body};\n`;
}

/**
 * The source of the `$implement/endpoints` virtual module (server-only): every
 * `server.ts` endpoint with its pattern, extension, and module namespace — the
 * shape the dev middleware and the endpoint prerenderer consume.
 */
export function generateEndpointsModule(
	tree: RouteTree,
	routesBase: string,
	openapi?: OpenApiRouteOptions,
): string {
	const routes = serverRoutes(tree);
	const keys = apiRoutes(tree);
	const imports: string[] = [];
	const entries: string[] = [];
	for (const [index, route] of routes.entries()) {
		const name = `endpoint_${index}`;
		imports.push(`import * as ${name} from ${JSON.stringify(`${routesBase}/${route.file}`)};`);
		const id =
			route.extension === null
				? routeId(route.pattern)
				: `${routeId(route.pattern) === "/" ? "" : routeId(route.pattern)}/${route.extension}`;
		entries.push(
			`\t{ pattern: ${JSON.stringify(route.pattern)}, id: ${JSON.stringify(id)}, extension: ${JSON.stringify(route.extension)}, file: ${JSON.stringify(route.file)}, module: ${name} },`,
		);
	}
	// the live OpenAPI route, when an app asked for one. It reads the same
	// module namespaces the table already imports, so mounting it costs the
	// document builder and the app's schema library — and nothing else
	if (openapi?.path !== undefined) {
		imports.unshift('import { openApiEndpoint } from "@implementjs/kit/openapi";');
		const documented = keys.map(
			(route, index) =>
				`\t\t{ key: ${JSON.stringify(route.key)}, params: ${JSON.stringify(route.params)}, file: ${JSON.stringify(route.file)}, module: endpoint_${index} }`,
		);
		const list = documented.length === 0 ? "[]" : `[\n${documented.join(",\n")},\n\t]`;
		entries.push(
			`\topenApiEndpoint({ path: ${JSON.stringify(openapi.path)}, options: ${JSON.stringify(openapi)}, endpoints: ${list} }),`,
		);
	}

	const header = imports.length === 0 ? "" : `${imports.join("\n")}\n\n`;
	const body = entries.length === 0 ? "[]" : `[\n${entries.join("\n")}\n]`;
	return `${header}export const endpoints = ${body};\n`;
}

/**
 * The source of the `$implement/hooks` virtual module (server-only): the
 * app's `src/hooks.server.ts` re-exported, or nothing when it has none.
 */
export function generateHooksModule(hooksFile: string | null): string {
	return hooksFile === null ? "export {};\n" : `export * from ${JSON.stringify(hooksFile)};\n`;
}

export type ApiRoute = {
	/**
	 * The URL the endpoint serves, params still in place:
	 * `routeId(pattern)` with any extension appended — `/api/posts/[id]`,
	 * `/docs/[...slug].md`. This is the key the generated client is called
	 * with, so it doubles as the URL template the client substitutes into.
	 */
	key: string;
	/** Param names the key binds, root first. */
	params: string[];
	/** Relative path of the `server.ts` file. */
	file: string;
};

/** Every `server.ts` endpoint as the generated client keys it. */
export function apiRoutes(tree: RouteTree): ApiRoute[] {
	return serverRoutes(tree).map((route) => ({
		key: `${routeId(route.pattern)}${route.extension ?? ""}`,
		params: route.params,
		file: route.file,
	}));
}

/** How the generated `createClient` is called and what it hands back. */
export type ClientStyle = {
	/** `"method"` for `api.GET(path, …)`, `"path"` for `api[path].GET(…)`. @default "method" */
	style?: "method" | "path";
	/** How a call's outcome reaches the caller. @default "result" */
	errors?: "result" | "throw" | "neverthrow";
};

/** The client type an app's `api.client` options select, and where it comes from. */
export type ClientType = {
	/** The entry to import from — the `neverthrow` style has one of its own. */
	module: string;
	/** The client type's name, taking the route table as its first argument. */
	name: string;
	/** A second type argument naming the return shape, when the name does not imply one. */
	wrapper: string | null;
};

/** Which of the six client types an app's options select. */
export function clientType(options: ClientStyle): ClientType {
	const path = options.style === "path";
	if (options.errors === "neverthrow") {
		return {
			module: "@implementjs/kit/client/neverthrow",
			name: path ? "ResultPathClient" : "ResultClient",
			wrapper: null,
		};
	}
	if (options.errors === "throw") {
		return {
			module: "@implementjs/kit/client",
			name: path ? "PathClient" : "MethodClient",
			wrapper: "ThrowWrapper",
		};
	}
	return {
		module: "@implementjs/kit/client",
		name: path ? "PathClient" : "TypedClient",
		wrapper: null,
	};
}

/** The client's type as a `.d.ts` writes it: fully qualified, importing nothing. */
export function clientTypeReference(options: ClientStyle, api: string): string {
	const client = clientType(options);
	const of = (name: string) => `import(${JSON.stringify(client.module)}).${name}`;
	const wrapper = client.wrapper === null ? "" : `, ${of(client.wrapper)}`;
	return `${of(client.name)}<${api}${wrapper}>`;
}

/** `{}` or `{ "id": string; "slug": string }` — the params a route key binds. */
function clientParamsType(params: string[]): string {
	if (params.length === 0) return "{}";
	return `{ ${params.map((name) => `${JSON.stringify(name)}: string`).join("; ")} }`;
}

/**
 * The generated `.implement/client.ts`: the app's route table and the
 * ready-made `api` built over it.
 *
 * The table names each route's key and params and reads its methods off the
 * module's *type* — `Operations<typeof import("../src/routes/…/server.ts")>` —
 * so which methods a `server.ts` exports never has to be known here. That is
 * what keeps this file a function of the route tree alone: the same `add` /
 * `unlink` watcher that regenerates the router covers it, with no `change`
 * handler and nothing evaluated. `typeof import(...)` is type-only, so the
 * emitted module carries no runtime reference to any `server.ts` either.
 */
export function generateClientModule(
	tree: RouteTree,
	routesBase: string,
	options: ClientStyle = {},
): string {
	const client = clientType(options);
	const type =
		client.wrapper === null ? `${client.name}<Api>` : `${client.name}<Api, ${client.wrapper}>`;
	const routes = apiRoutes(tree);
	const entries = routes.map((route) => {
		const specifier = JSON.stringify(`..${routesBase}/${route.file}`);
		return [
			`\t${JSON.stringify(route.key)}: {`,
			`\t\tparams: ${clientParamsType(route.params)};`,
			`\t\toperations: Operations<typeof import(${specifier})>;`,
			"\t};",
		].join("\n");
	});
	const names = client.wrapper === null ? [client.name] : [client.name, client.wrapper];
	const imported = ["createClient as create", "type ClientOptions", "type Operations"]
		.concat(names.map((name) => `type ${name}`))
		.join(",\n\t");
	const call =
		options.errors === "throw" ? `create({ ...options, errors: "throw" })` : "create(options)";
	const table = entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`;
	return `${[
		`import {\n\t${imported},\n} from ${JSON.stringify(client.module)};`,
		"",
		"/** Every `server.ts` endpoint in this app, keyed by the URL it serves. */",
		`export type Api = ${table};`,
		"",
		"/** A client pointing somewhere other than this app — a different base URL, headers of its own. */",
		`export function createClient(options?: ClientOptions): ${type} {`,
		`\treturn ${call};`,
		"}",
		"",
		"/** The app's own API, ready to use. Relative URLs, which is what a browser wants; on the server use `event.api`. */",
		`export const api: ${type} = createClient();`,
	].join("\n")}\n`;
}
