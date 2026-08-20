import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { dataChains, pageRoutes, type DataChain, type PageRoute } from "./codegen.ts";
import { type RouteNode, type RouteTree } from "./scan.ts";

export const IMPLEMENT_DIR = ".implement";

const ENTRY_CLIENT = `import { App } from "@implementjs/core";
import { initClientData } from "@implementjs/kit/runtime";
import { router } from "$implement/router";

initClientData();

const app = App({ target: document.body });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(router);
`;

const ENTRY_SERVER = `import { renderToString, type RenderToStringResult } from "@implementjs/core/server";
import { resolveLoads, seedData, type RouteData } from "@implementjs/kit/runtime";
import { loads } from "$implement/loads";
import { router } from "$implement/router";

export type RenderResult = RenderToStringResult & { data?: RouteData };

export async function render(url: string): Promise<RenderResult> {
	const data = await resolveLoads(loads, url);
	if (data !== null) seedData(data);
	const result = renderToString(router, { location: url });
	return data === null ? result : { ...result, data };
}
`;

/** Aliases every kit app gets; \`KitOptions.alias\` entries merge over them. */
export const DEFAULT_ALIASES: Record<string, string> = { "@/lib": "src/lib" };

/**
 * The tsconfig apps extend. rootDirs merges the app root with the generated
 * types dir, so route files resolve \`./$types\`; paths mirrors the aliases
 * the plugin sets up in Vite (relative paths in an extended config resolve
 * against this file, so root-relative targets get a \`../\` prefix).
 */
export function generateTsconfig(aliases: Record<string, string>): string {
	const paths: Record<string, string[]> = {};
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

function paramsType(params: string[]): string {
	if (params.length === 0) return "{}";
	return `{ ${params.map((name) => `${JSON.stringify(name)}: Readable<string>`).join("; ")} }`;
}

function serverParamsType(params: string[]): string {
	if (params.length === 0) return "{}";
	return `{ ${params.map((name) => `${JSON.stringify(name)}: string`).join("; ")} }`;
}

/** The relative specifier resolving a routes-relative file from a route directory's \`$types\`. */
function relativeImport(dir: string, file: string): string {
	const up = dir === "" ? 0 : dir.split("/").length;
	return up === 0 ? `./${file}` : `${"../".repeat(up)}${file}`;
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

/** The \`./$types\` module for one route directory. */
export function generateRouteTypes(node: RouteNode, chain: DataChain): string {
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
	return `import type { Mountable, Readable, RouterError, RouterLocation } from "@implementjs/core";
${helpers}
export type RouteParams = ${paramsType(node.params)};
export type ServerParams = ${serverParamsType(node.params)};
export type LoadEvent = { params: ServerParams; url: URL };
export type RequestEvent = { request: Request; params: ServerParams; url: URL };
export type LayoutData = ${dataType(node.dir, chain.layoutFiles)};
export type PageData = ${dataType(node.dir, chain.pageFiles)};
export type PageProps = { params: RouteParams; url: Readable<RouterLocation>; data: Readable<PageData> };
export type LayoutProps = { children: Mountable; params: RouteParams; url: Readable<RouterLocation>; data: Readable<LayoutData> };
export type ErrorProps = { error: RouterError; url: Readable<RouterLocation> };
`;
}

/** The \`./$types\` module for a \`.<ext>\` extension-endpoint directory. */
export function generateExtensionTypes(node: RouteNode): string {
	return `export type ServerParams = ${serverParamsType(node.params)};
export type RequestEvent = { request: Request; params: ServerParams; url: URL };
`;
}

/** The ambient declarations typing the \`$implement/*\` virtual modules. */
export function generateRouterDeclaration(routes: PageRoute[]): string {
	const entries = routes
		.map(
			(route) =>
				`\t\t${JSON.stringify(route.pattern)}: (params: ${paramsType(route.params)}) => Child;`,
		)
		.join("\n");
	return `declare module "$implement/router" {
	import type { Child, Readable, RouterHelper } from "@implementjs/core";

	export const router: RouterHelper<{
${entries}
	}>;
}

declare module "$implement/loads" {
	import type { LoadRoute } from "@implementjs/kit/runtime";

	export const loads: LoadRoute[];
}

declare module "$implement/endpoints" {
	import type { EndpointRoute } from "@implementjs/kit/runtime";

	export const endpoints: EndpointRoute[];
}
`;
}

export type SyncOptions = {
	/** Routes directory relative to the app root. @default "src/routes" */
	routes?: string;
	/** Extra aliases (name → path relative to the app root) for the generated tsconfig, on top of `@/lib` → `src/lib`. */
	alias?: Record<string, string>;
};

/**
 * Writes the generated \`.implement/\` directory for an app: virtual-entry
 * files, the tsconfig apps extend, and per-route \`./$types\` declarations.
 * Idempotent — files are only rewritten when their content changed, and
 * stale \`$types\` files from removed routes are pruned.
 */
export function writeGenerated(root: string, tree: RouteTree, options: SyncOptions = {}): void {
	const routesDir = options.routes ?? "src/routes";
	const outDir = join(root, IMPLEMENT_DIR);
	const typesDir = join(outDir, "types");
	mkdirSync(typesDir, { recursive: true });

	writeIfChanged(join(outDir, ".gitignore"), "*\n");
	writeIfChanged(join(outDir, "entry-client.ts"), ENTRY_CLIENT);
	writeIfChanged(join(outDir, "entry-server.ts"), ENTRY_SERVER);
	writeIfChanged(
		join(outDir, "tsconfig.json"),
		generateTsconfig({ ...DEFAULT_ALIASES, ...options.alias }),
	);
	writeIfChanged(join(typesDir, "$implement.d.ts"), generateRouterDeclaration(pageRoutes(tree)));

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
				generateRouteTypes(node, chains.get(node)!),
			);
		}
		for (const extension of node.extensions) {
			write(
				join(typesDir, routesDir, node.dir, extension.extension, "$types.d.ts"),
				generateExtensionTypes(node),
			);
		}
		for (const child of node.children) emit(child);
	};
	emit(tree.root);
	// error.ts imports the root ./$types too
	if (tree.error !== null && !expected.has(join(typesDir, routesDir, "$types.d.ts"))) {
		write(
			join(typesDir, routesDir, "$types.d.ts"),
			generateRouteTypes(tree.root, chains.get(tree.root)!),
		);
	}
	pruneStaleTypes(join(typesDir, routesDir), expected);
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
