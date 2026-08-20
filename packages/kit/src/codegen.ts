import { segmentKey, type RouteNode, type RouteTree } from "./scan.ts";

/**
 * The source of the `$implement/router` virtual module: imports every page and
 * layout, adapts them onto `@implementjs/core`'s `Router` tree, and exports
 * the router. Pages render as `Page({ params, url })`, layouts as
 * `Layout({ children, params, url })`, and a root `error.ts` becomes the
 * router fallback.
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

	const nodeExpr = (node: RouteNode, indent: string): string => {
		const inner = `${indent}\t`;
		const entries: string[] = [];
		if (node.layout !== null) {
			const name = importFor(node.layout, "Layout");
			entries.push(
				`${inner}layout: (children, params) => ${name}({ children, params, url: router.location }),`,
			);
		}
		if (node.page !== null) {
			const name = importFor(node.page, "Page");
			entries.push(`${inner}"/": (params) => ${name}({ params, url: router.location }),`);
		}
		for (const child of node.children) {
			const key = JSON.stringify(segmentKey(child.segment!));
			entries.push(`${inner}${key}: ${nodeExpr(child, inner)},`);
		}
		return `{\n${entries.join("\n")}\n${indent}}`;
	};

	const routes = nodeExpr(tree.root, "");
	const fallback =
		tree.error === null
			? ""
			: `, {\n\tfallback: () => ${importFor(tree.error, "ErrorPage")}({ url: router.location }),\n}`;

	return `${imports.join("\n")}\n\nexport const router = Router(${routes}${fallback});\n`;
}

export type PageRoute = {
	/** Full path pattern, `:param`/`:...rest` style (`/docs/:...slug`). */
	pattern: string;
	/** Param names the pattern binds, root first. */
	params: string[];
};

/** Every page in the tree with its full path pattern. */
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
