import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pageRoutes, type PageRoute } from "./codegen.ts";
import { type RouteNode, type RouteTree } from "./scan.ts";

export const IMPLEMENT_DIR = ".implement";

const ENTRY_CLIENT = `import { App } from "@implementjs/core";
import { router } from "$implement/router";

const app = App({ target: document.body });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(router);
`;

const ENTRY_SERVER = `import { renderToString, type RenderToStringResult } from "@implementjs/core/server";
import { router } from "$implement/router";

export function render(url: string): RenderToStringResult {
	return renderToString(router, { location: url });
}
`;

/** rootDirs merges the app root with the generated types dir, so route files resolve \`./$types\`. */
const TSCONFIG = `{
	"compilerOptions": {
		"rootDirs": ["..", "./types"]
	},
	"include": ["./types/**/*.d.ts", "./*.ts", "../src/**/*"]
}
`;

function paramsType(params: string[]): string {
	if (params.length === 0) return "{}";
	return `{ ${params.map((name) => `${JSON.stringify(name)}: Readable<string>`).join("; ")} }`;
}

/** The \`./$types\` module for one route directory. */
export function generateRouteTypes(node: RouteNode): string {
	return `import type { Mountable, Readable, RouterLocation } from "@implementjs/core";

export type RouteParams = ${paramsType(node.params)};
export type PageProps = { params: RouteParams; url: Readable<RouterLocation> };
export type LayoutProps = { children: Mountable; params: RouteParams; url: Readable<RouterLocation> };
export type ErrorProps = { url: Readable<RouterLocation> };
`;
}

/** The ambient declaration typing the \`$implement/router\` virtual module. */
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
`;
}

export type SyncOptions = {
	/** Routes directory relative to the app root. @default "src/routes" */
	routes?: string;
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
	writeIfChanged(join(outDir, "tsconfig.json"), TSCONFIG);
	writeIfChanged(join(typesDir, "$implement.d.ts"), generateRouterDeclaration(pageRoutes(tree)));

	const expected = new Set<string>();
	const emit = (node: RouteNode) => {
		if (node.page !== null || node.layout !== null) {
			const target = join(typesDir, routesDir, node.dir, "$types.d.ts");
			expected.add(target);
			mkdirSync(dirname(target), { recursive: true });
			writeIfChanged(target, generateRouteTypes(node));
		}
		for (const child of node.children) emit(child);
	};
	emit(tree.root);
	// error.ts imports the root ./$types too
	if (tree.error !== null && tree.root.page === null && tree.root.layout === null) {
		const target = join(typesDir, routesDir, "$types.d.ts");
		expected.add(target);
		mkdirSync(dirname(target), { recursive: true });
		writeIfChanged(target, generateRouteTypes(tree.root));
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
