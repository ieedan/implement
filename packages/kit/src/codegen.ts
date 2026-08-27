import { routeId } from "./match.ts";
import { CONVERTER_PACKAGES, type OpenApiRouteOptions } from "./openapi.ts";
import {
	segmentKey,
	type RouteNode,
	type RouteParam,
	type RouteSegment,
	type RouteTree,
} from "./scan.ts";

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

/** Every node with its full path pattern. `(group)` segments contribute nothing. */
function nodePatterns(tree: RouteTree): Map<RouteNode, string> {
	const patterns = new Map<RouteNode, string>();
	const walk = (node: RouteNode, prefix: string) => {
		patterns.set(node, prefix === "" ? "/" : prefix);
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(tree.root, "");
	return patterns;
}

/** Every page node with its full path pattern. */
function pagePatterns(tree: RouteTree): Map<RouteNode, string> {
	const patterns = new Map<RouteNode, string>();
	for (const [node, pattern] of nodePatterns(tree)) {
		if (node.page !== null) patterns.set(node, pattern);
	}
	return patterns;
}

/**
 * Every `error.ts` in the tree with the pattern of the directory it covers —
 * the error boundaries, root first. A path is served by the deepest one whose
 * directory it falls inside, so `app/[slug]/error.ts` answers for everything
 * under `/app/:slug` and the root's answers for the rest.
 */
export function errorPatterns(tree: RouteTree): { node: RouteNode; pattern: string }[] {
	return [...nodePatterns(tree).entries()]
		.filter(([node]) => node.error !== null)
		.map(([node, pattern]) => ({ node, pattern }));
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
 * The source of the `$implement/params` virtual module: the app's param
 * matchers, keyed by the name a `[param=<name>]` directory uses.
 *
 * One entry per `<params>/<name>.ts`. The imports are real — a matcher runs on
 * both sides of a navigation, so unlike the load chain there is nothing here
 * to keep out of the browser bundle. `matcherTable` is what turns a module
 * that forgot to default-export a `matcher()` into a message naming the file.
 */
export function generateParamsModule(tree: RouteTree, paramsBase: string): string {
	const imports = tree.matchers.map(
		(name, index) => `import matcher_${index} from ${JSON.stringify(`${paramsBase}/${name}.ts`)};`,
	);
	const entries = tree.matchers.map(
		(name, index) => `\t\t${JSON.stringify(name)}: matcher_${index},`,
	);
	// the app's spread last, so a `src/params/integer.ts` of its own wins and a
	// built-in stays a default rather than a reserved word
	return `${[
		'import { builtinMatchers, matcherTable } from "@implementjs/kit/params";',
		imports.join("\n"),
		"",
		`export const matchers = {\n\t...builtinMatchers,\n\t...matcherTable({\n${entries.join(
			"\n",
		)}\n}, ${JSON.stringify(paramsBase.replace(/^\//, ""))}),\n};`,
	].join("\n")}\n`;
}

/**
 * The source of the `$implement/router` virtual module: declares a lazy handle
 * per page and layout, adapts them onto `@implementjs/router`'s `Router` tree,
 * and exports the router. Pages render as `Page.get()({ params, url, data })`
 * and layouts as `Layout.get()({ children, params, url, data })`. `data` is a
 * readable merging what the route's `*.server.ts` loads returned (empty when
 * the route has none); routes with loads are also registered with the client
 * runtime so navigation fetches their data before committing.
 *
 * Every `error.ts` becomes an entry in `errorBoundaries`: the pattern of the
 * directory it covers, the layouts that wrap it, and `ErrorPage({ error, url })`.
 * The runtime picks the deepest boundary a path falls inside and renders the
 * error page inside those layouts, so a 404 in a section keeps the section's
 * shell and the root `error.ts` stays the fallback for everything else.
 *
 * Every page and layout is behind a `lazyModule` handle so Rollup splits the
 * app by route: nothing but the entry route's chunks loads up front. The
 * handles are declared, never awaited here — the route factories stay
 * synchronous, and `registerRouteModules` tells the runtime which handles each
 * route needs so the render paths can preload them (see `./lazy.ts`). An
 * `error.ts` stays a static import: it renders paths no route matched, so it
 * cannot sit behind a route match, and it is small. The layouts around it are
 * still handles, which `registerErrorRoutes` is what lets the render paths
 * preload.
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
	const hasMatchers = tree.matchers.length > 0;
	const imports: string[] = ['import { Router } from "@implementjs/router";'];
	if (hasMatchers) imports.push('import { matchers } from "$implement/params";');
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

	/** An error page, which no route match gates and so cannot be lazy. */
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

	/** A layout, in the `(children, params)` form the router calls one with. */
	const layoutExpr = (node: RouteNode): string => {
		const name = lazyFor(node.layout!, "Layout");
		const data = routeDataExpr(chains.get(node)!.layoutFiles);
		return `(children, params) => ${name}.get()({ children, params, url: router.location, data: ${data} })`;
	};

	const nodeExpr = (node: RouteNode, indent: string): string => {
		const inner = `${indent}\t`;
		const entries: string[] = [];
		if (node.layout !== null) {
			entries.push(`${inner}layout: ${layoutExpr(node)},`);
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

	// the error boundaries, each with the layouts that wrap its `error.ts` — the
	// chain its own directory's page would render in, so a section's error page
	// keeps the section's shell
	const layoutChains = nodeChains(tree);
	const boundaries = errorPatterns(tree).map(({ node, pattern }) => {
		const layouts = layoutChains.get(node)!.layout.filter((entry) => entry.layout !== null);
		const page = importFor(node.error!, "ErrorPage");
		return [
			"\t{",
			`\t\tpattern: ${JSON.stringify(pattern)},`,
			`\t\tmodules: [${layouts.map((entry) => JSON.stringify(routeModuleId(routesBase, entry.layout!))).join(", ")}],`,
			`\t\tlayouts: [${layouts.map(layoutExpr).join(", ")}],`,
			`\t\tpage: (error) => ${page}({ error, url: router.location }),`,
			"\t},",
		].join("\n");
	});

	const routerOptions = [
		...(hasMatchers ? ["\tmatchers,"] : []),
		...(boundaries.length === 0
			? []
			: ["\tfallback: (error) => renderErrorPage(error, router.location.get().path),"]),
	];
	const fallback = routerOptions.length === 0 ? "" : `, {\n${routerOptions.join("\n")}\n}`;

	// only what the module actually uses, so a tree with no pages at all still
	// emits an import list that type-checks and tree-shakes cleanly
	const runtimeImports = [
		...(declarations.length > 0 ? ["lazyModule"] : []),
		...(boundaries.length > 0 ? ["registerErrorRoutes"] : []),
		...(hasMatchers ? ["registerMatchers"] : []),
		...(modules.length > 0 ? ["registerRouteModules"] : []),
		...(manifest.length > 0 ? ["registerRoutes"] : []),
		...(boundaries.length > 0 ? ["renderErrorPage"] : []),
		"routeData",
	];
	imports.splice(1, 0, `import { ${runtimeImports.join(", ")} } from "@implementjs/kit/runtime";`);

	const blocks = [
		imports.join("\n"),
		...(declarations.length > 0 ? [declarations.join("\n")] : []),
		...(boundaries.length === 0 ? [] : [`const errorBoundaries = [\n${boundaries.join("\n")}\n];`]),
		`export const router = Router(${routes}${fallback});`,
		// before the route tables: the preloader and the data fetch resolve a path
		// through them, and both consult the matchers to do it
		...(hasMatchers ? ["registerMatchers(matchers);"] : []),
		...(modules.length > 0
			? [`registerRouteModules(${JSON.stringify(modules, null, "\t")});`]
			: []),
		...(manifest.length > 0 ? [`registerRoutes(${JSON.stringify(manifest, null, "\t")});`] : []),
		// the boundaries go to the runtime as well as to the fallback: the server
		// renders an error page on its own for a thrown error, where there is no
		// router match to fall back through, and both paths preload the layouts
		// around the boundary through the same registry
		...(boundaries.length === 0 ? [] : ["registerErrorRoutes(errorBoundaries);"]),
	];
	return `${blocks.join("\n\n")}\n`;
}

export type PageRoute = {
	/** Full path pattern, `:param`/`:...rest` style (`/docs/:...slug`). */
	pattern: string;
	/** The params the pattern binds, root first, each with the matcher gating it. */
	params: RouteParam[];
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
	/** The params the pattern binds, root first, each with the matcher gating it. */
	params: RouteParam[];
	/** Relative path of the `server.ts` file. */
	file: string;
	/** Whether the module exports a `SOCKET` handler — see {@link import("./scan.ts").exportsSocket}. */
	socket: boolean;
};

/** Every `server.ts` endpoint in the tree, extension endpoints included. */
export function serverRoutes(tree: RouteTree): ServerRoute[] {
	const routes: ServerRoute[] = [];
	const walk = (node: RouteNode, prefix: string) => {
		const pattern = prefix === "" ? "/" : prefix;
		if (node.endpoint !== null) {
			routes.push({
				pattern,
				extension: null,
				params: node.params,
				file: node.endpoint,
				socket: node.endpointSocket,
			});
		}
		for (const extension of node.extensions) {
			routes.push({
				pattern,
				extension: extension.extension,
				params: node.params,
				file: extension.file,
				socket: extension.socket,
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
 * request pipeline matches against and runs loads from — and, beside it, the
 * error boundaries with the loads feeding the layouts *they* render inside.
 *
 * The pipeline runs a boundary's chain when it is about to render an error
 * page: the layouts around a section's `error.ts` are the section's own, and a
 * shell rendered without the data its load returns is a shell with no
 * workspace in the switcher and no counts in the sidebar.
 */
export function generatePagesModule(tree: RouteTree, routesBase: string): string {
	const chains = dataChains(tree);
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

	const entry = (pattern: string, files: string[]): string => {
		const parts = files.map((file) => `{ id: ${JSON.stringify(file)}, load: ${importFor(file)} }`);
		return `\t{ pattern: ${JSON.stringify(pattern)}, id: ${JSON.stringify(routeId(pattern))}, files: [${parts.join(", ")}] },`;
	};

	const pages = [...pagePatterns(tree).entries()].map(([node, pattern]) =>
		entry(pattern, chains.get(node)!.pageFiles),
	);
	const errors = errorPatterns(tree).map(({ node, pattern }) =>
		entry(pattern, chains.get(node)!.layoutFiles),
	);

	const header = imports.length === 0 ? "" : `${imports.join("\n")}\n\n`;
	return `${header}export const pages = ${routeList(pages)};\n\nexport const errors = ${routeList(errors)};\n`;
}

/** The manifest entries as an array literal, or `[]` when there are none. */
function routeList(entries: string[]): string {
	return entries.length === 0 ? "[]" : `[\n${entries.join("\n")}\n]`;
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
		// the matchers come along so a `[id=integer]` param is documented as what
		// the matcher parses it to; they are the same table the router matches
		// with, and an app with none passes nothing
		const matchers = tree.matchers.length === 0 ? "" : ", matchers";
		if (matchers !== "") imports.unshift('import { matchers } from "$implement/params";');
		entries.push(
			`\topenApiEndpoint({ path: ${JSON.stringify(openapi.path)}, options: ${JSON.stringify(openapi)}, endpoints: ${list}${matchers} }),`,
		);
	}

	const header = imports.length === 0 ? "" : `${imports.join("\n")}\n\n`;
	const body = entries.length === 0 ? "[]" : `[\n${entries.join("\n")}\n]`;
	return `${header}export const endpoints = ${body};\n`;
}

/** The `$implement/schema-converters` module with nothing in it. */
export const EMPTY_CONVERTERS = "export const converters = {};\n";

/**
 * The source of the `$implement/schema-converters` virtual module
 * (server-only): every JSON-Schema converter package the app has installed,
 * behind a static import so the bundler writes it into the server bundle.
 *
 * A converter reached through a variable specifier is one the bundler never
 * sees, so it never ships — and an adapter's output has no `node_modules` for
 * the bare specifier to resolve against at runtime. `tools/list` then converts
 * nothing and every tool goes out unconstrained. Naming the packages here is
 * what puts them in the bundle; naming only the installed ones is what keeps an
 * app that uses valibot from having to own zod's converter.
 */
export async function generateConvertersModule(
	installed: (specifier: string) => Promise<boolean>,
): Promise<string> {
	// sorted, so the module a build emits is a function of what is installed and
	// nothing else — two vendors can name the same package
	const packages = [...new Set(Object.values(CONVERTER_PACKAGES))].toSorted();
	const present = (
		await Promise.all(packages.map(async (name) => ((await installed(name)) ? name : null)))
	).filter((name): name is string => name !== null);
	if (present.length === 0) return EMPTY_CONVERTERS;
	const imports = present.map(
		(name, index) => `import * as converter_${index} from ${JSON.stringify(name)};`,
	);
	const entries = present.map((name, index) => `\t${JSON.stringify(name)}: converter_${index},`);
	return `${imports.join("\n")}\n\nexport const converters = {\n${entries.join("\n")}\n};\n`;
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
	/** The params the key binds, root first, each with the matcher gating it. */
	params: RouteParam[];
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
	/** `"method"` for `api.GET(path, …)`, `"nested"` for `api.api.posts["[id]"].GET(…)`. @default "method" */
	style?: "method" | "nested";
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
	const nested = options.style === "nested";
	if (options.errors === "neverthrow") {
		return {
			module: "@implementjs/kit/client/neverthrow",
			name: nested ? "ResultNestedClient" : "ResultClient",
			wrapper: null,
		};
	}
	if (options.errors === "throw") {
		return {
			module: "@implementjs/kit/client",
			name: nested ? "NestedClient" : "MethodClient",
			wrapper: "ThrowWrapper",
		};
	}
	return {
		module: "@implementjs/kit/client",
		name: nested ? "NestedClient" : "TypedClient",
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

/**
 * `{}` or `{ "id": number; "slug": string }` — the params a route key binds, a
 * matched one typed by what its matcher makes of the segment.
 */
function clientParamsType(
	params: RouteParam[],
	paramsSpecifier: string,
	appMatchers: readonly string[],
): string {
	if (params.length === 0) return "{}";
	const entries = params.map(
		(param) =>
			`${JSON.stringify(param.name)}: ${matcherTypeExpr(param, paramsSpecifier, appMatchers)}`,
	);
	return `{ ${entries.join("; ")} }`;
}

/**
 * The type a param carries: `string` when nothing gates it, and otherwise what
 * the matcher module makes of a segment — read off the matcher's own type, so
 * the matcher declares it once and every route naming it inherits it.
 */
export function matcherTypeExpr(
	param: RouteParam,
	paramsSpecifier: string,
	appMatchers: readonly string[],
): string {
	if (param.matcher === null) return "string";
	// a name the app has no file for is a built-in — the scan already refused
	// any name that is neither, so there is no third case to fall through to
	if (!appMatchers.includes(param.matcher)) {
		return `import("@implementjs/kit/params").ParamType<
			(typeof import("@implementjs/kit/params").builtinMatchers)[${JSON.stringify(param.matcher)}]
		>`.replaceAll(/\s+/g, " ");
	}
	const specifier = JSON.stringify(`${paramsSpecifier}/${param.matcher}.ts`);
	return `import("@implementjs/kit/params").ParamType<typeof import(${specifier}).default>`;
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
	paramsBase: string,
	options: ClientStyle = {},
): string {
	const client = clientType(options);
	const type =
		client.wrapper === null ? `${client.name}<Api>` : `${client.name}<Api, ${client.wrapper}>`;
	const routes = apiRoutes(tree);
	// the generated client sits at `.implement/client.ts`, one level under the
	// app root the two bases are relative to
	const paramsSpecifier = `..${paramsBase}`;
	const entries = routes.map((route) => {
		const specifier = JSON.stringify(`..${routesBase}/${route.file}`);
		return [
			`\t${JSON.stringify(route.key)}: {`,
			`\t\tparams: ${clientParamsType(route.params, paramsSpecifier, tree.matchers)};`,
			`\t\toperations: Operations<typeof import(${specifier})>;`,
			"\t};",
		].join("\n");
	});
	const names = client.wrapper === null ? [client.name] : [client.name, client.wrapper];
	const imported = ["createClient as create", "type ClientOptions", "type Operations"]
		.concat(names.map((name) => `type ${name}`))
		.join(",\n\t");
	// whatever the app fixed in its config, the generated `createClient` fixes
	// too — the type says `throw`/nested, so the call has to actually be that
	const fixed = [
		options.errors === "throw" ? `errors: "throw"` : null,
		options.style === "nested" ? `style: "nested"` : null,
	].filter((entry) => entry !== null);
	const call =
		fixed.length === 0 ? "create(options)" : `create({ ...options, ${fixed.join(", ")} })`;
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
