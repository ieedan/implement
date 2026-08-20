import { segmentKey, type RouteNode, type RouteSegment, type RouteTree } from "./scan.ts";

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
 * the router. Pages render as `Page({ params, url })`, layouts as
 * `Layout({ children, params, url })`, and a root `error.ts` becomes the
 * router fallback, rendered as `ErrorPage({ error, url })`.
 *
 * `@` layout resets are realized by hoisting: a reset page (or a subtree whose
 * layout resets) is emitted at its target ancestor under the full key from
 * there, so only the layouts at and above the target wrap it.
 */
export function generateRouterModule(tree: RouteTree, routesBase: string): string {
	const imports: string[] = ['import { Router } from "@implementjs/core";'];
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

	const nodeExpr = (node: RouteNode, indent: string): string => {
		const inner = `${indent}\t`;
		const entries: string[] = [];
		if (node.layout !== null) {
			const name = importFor(node.layout, "Layout");
			entries.push(
				`${inner}layout: (children, params) => ${name}({ children, params, url: router.location }),`,
			);
		}
		if (node.page !== null && !hoistedPages.has(node)) {
			const name = importFor(node.page, "Page");
			entries.push(`${inner}"/": (params) => ${name}({ params, url: router.location }),`);
		}
		for (const child of node.children) {
			if (detached.has(child)) continue;
			const key = JSON.stringify(routerKey(child.segment!));
			entries.push(`${inner}${key}: ${nodeExpr(child, inner)},`);
		}
		for (const hoist of hoists.get(node) ?? []) {
			if (hoist.kind === "page") {
				const name = importFor(hoist.source.page!, "Page");
				entries.push(
					`${inner}${JSON.stringify(hoist.key)}: (params) => ${name}({ params, url: router.location }),`,
				);
			} else {
				entries.push(`${inner}${JSON.stringify(hoist.key)}: ${nodeExpr(hoist.source, inner)},`);
			}
		}
		return `{\n${entries.join("\n")}\n${indent}}`;
	};

	const routes = nodeExpr(tree.root, "");
	const fallback =
		tree.error === null
			? ""
			: `, {\n\tfallback: (error) => ${importFor(tree.error, "ErrorPage")}({ error, url: router.location }),\n}`;

	return `${imports.join("\n")}\n\nexport const router = Router(${routes}${fallback});\n`;
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
