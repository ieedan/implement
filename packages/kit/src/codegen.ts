import { routeId } from "./match.ts";
import { segmentKey, type RouteNode, type RouteSegment, type RouteTree } from "./scan.ts";

export type DataChain = {
	/** Server files (root first) feeding this directory's layout `data`. */
	layoutFiles: string[];
	/** Server files (root first) feeding this directory's page `data`. */
	pageFiles: string[];
};

/**
 * The server-load files that feed each directory's layout and page `data`,
 * resets applied: the chain follows the layouts that actually wrap the
 * render, so an `@` reset also resets which ancestor loads contribute.
 */
export function dataChains(tree: RouteTree): Map<RouteNode, DataChain> {
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

	/** The nodes whose layouts wrap this directory, this directory last. */
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

	const serverFiles = (chain: RouteNode[]): string[] =>
		chain.flatMap((entry) => (entry.layoutServer === null ? [] : [entry.layoutServer]));

	const chains = new Map<RouteNode, DataChain>();
	const walk = (node: RouteNode) => {
		chains.set(node, {
			layoutFiles: serverFiles(effectiveChain(node)),
			pageFiles: [
				...serverFiles(pageChain(node)),
				...(node.pageServer === null ? [] : [node.pageServer]),
			],
		});
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return chains;
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
 * Pathless key segment marking a hoisted `index@` page, so it never collides
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

/**
 * The source of the `$implement/router` virtual module: imports every page and
 * layout, adapts them onto `@implementjs/core`'s `Router` tree, and exports
 * the router. Pages render as `Page({ params, url, data })`, layouts as
 * `Layout({ children, params, url, data })`, and a root `error.ts` becomes the
 * router fallback, rendered as `ErrorPage({ error, url })`. `data` is a
 * readable merging what the route's `*.server.ts` loads returned (empty when
 * the route has none); routes with loads are also registered with the client
 * runtime so navigation fetches their data before committing.
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
	const runtimeImports = manifest.length > 0 ? "registerRoutes, routeData" : "routeData";
	const imports: string[] = [
		'import { Router } from "@implementjs/core";',
		`import { ${runtimeImports} } from "@implementjs/kit/runtime";`,
	];
	const names = new Map<string, string>();
	let counter = 0;

	const importFor = (file: string, kind: string): string => {
		let name = names.get(file);
		if (name === undefined) {
			name = `${kind}_${counter++}`;
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

	const dataExpr = (files: string[]): string => `routeData(${JSON.stringify(files)})`;

	const pageExpr = (node: RouteNode): string => {
		const name = importFor(node.page!, "Page");
		const data = dataExpr(chains.get(node)!.pageFiles);
		return `(params) => ${name}({ params, url: router.location, data: ${data} })`;
	};

	const nodeExpr = (node: RouteNode, indent: string): string => {
		const inner = `${indent}\t`;
		const entries: string[] = [];
		if (node.layout !== null) {
			const name = importFor(node.layout, "Layout");
			const data = dataExpr(chains.get(node)!.layoutFiles);
			entries.push(
				`${inner}layout: (children, params) => ${name}({ children, params, url: router.location, data: ${data} }),`,
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

	const register =
		manifest.length === 0 ? "" : `\n\nregisterRoutes(${JSON.stringify(manifest, null, "\t")});`;
	// the server renders the error page on its own for a 404 or a thrown error,
	// where there is no router match to fall back through
	const errorExport =
		errorName === null
			? ""
			: `\n\nexport const errorPage = (error) => ${errorName}({ error, url: router.location });`;

	return `${imports.join("\n")}\n\nexport const router = Router(${routes}${fallback});${register}${errorExport}\n`;
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
export function generateEndpointsModule(tree: RouteTree, routesBase: string): string {
	const routes = serverRoutes(tree);
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
