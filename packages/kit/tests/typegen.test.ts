import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test fixtures and generated output require intentional narrowing. */
import { afterEach, describe, expect, it } from "vitest";
import { scanRoutes } from "../src/scan.ts";
import {
	generateAppDeclaration,
	generateExtensionTypes,
	generateRouteTypes,
	generateRouterDeclaration,
	generateTsconfig,
	routerAliases,
	ROUTER_PACKAGE,
	writeGenerated,
} from "../src/typegen.ts";

let root: string | null = null;

function makeApp(files: string[]): string {
	root = mkdtempSync(join(tmpdir(), "implement-kit-app-"));
	for (const file of files) {
		const path = join(root, "src/routes", file);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, "export default () => null;\n");
	}
	return root;
}

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

const PATHS = { routes: "src/routes", params: "src/params" };

const slugNode = {
	dir: "docs/[...slug]",
	segment: { kind: "rest", name: "slug", matcher: null } as const,
	params: [{ name: "slug", matcher: null }],
	page: "docs/[...slug]/page.ts",
	pageResetTo: null,
	layout: null,
	layoutResetTo: null,
	pageServer: null,
	layoutServer: null,
	endpoint: null,
	error: null,
	extensions: [],
	children: [],
};

describe("generateRouteTypes", () => {
	it("types params as Readables and server params as strings", () => {
		const types = generateRouteTypes(slugNode, { layoutFiles: [], pageFiles: [] }, PATHS);
		expect(types).toContain('export type RouteParams = { "slug": Readable<string> };');
		expect(types).toContain('export type ServerParams = { "slug": string };');
		expect(types).toContain("export type LoadEvent = KitLoadEvent<ServerParams, PageParentData>;");
		expect(types).toContain("export type RequestEvent = KitRequestEvent<ServerParams>;");
		expect(types).toContain("export type PageProps = { params: RouteParams;");
		expect(types).toContain("data: Readable<PageData>");
		expect(types).toContain("children: Mountable");
	});

	it("types data as the merged load chain", () => {
		const types = generateRouteTypes(
			slugNode,
			{
				layoutFiles: ["layout.server.ts"],
				pageFiles: ["layout.server.ts", "docs/[...slug]/page.server.ts"],
			},
			PATHS,
		);
		expect(types).toContain(
			'export type LayoutData = Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>;',
		);
		expect(types).toContain(
			'export type PageData = Merge<Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>, LoadData<typeof import("../../docs/[...slug]/page.server.ts").default>>;',
		);
	});

	it("types parent() as the chain above the load, its own file dropped", () => {
		const types = generateRouteTypes(
			{
				...slugNode,
				layoutServer: "docs/[...slug]/layout.server.ts",
				pageServer: "docs/[...slug]/page.server.ts",
			},
			{
				layoutFiles: ["layout.server.ts", "docs/[...slug]/layout.server.ts"],
				pageFiles: [
					"layout.server.ts",
					"docs/[...slug]/layout.server.ts",
					"docs/[...slug]/page.server.ts",
				],
			},
			PATHS,
		);
		// the page's parent is both layouts above it
		expect(types).toContain(
			'export type PageParentData = Merge<Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>, LoadData<typeof import("../../docs/[...slug]/layout.server.ts").default>>;',
		);
		// this directory's own layout load is not its own parent
		expect(types).toContain(
			'export type LayoutParentData = Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>;',
		);
		expect(types).toContain(
			"export type LayoutLoadEvent = KitLoadEvent<ServerParams, LayoutParentData>;",
		);
	});
});

describe("the handler export", () => {
	const endpointNode = { ...slugNode, page: null, endpoint: "docs/[...slug]/server.ts" };

	it("is on an endpoint directory's $types, bound to that route's params", () => {
		const types = generateRouteTypes(endpointNode, { layoutFiles: [], pageFiles: [] }, PATHS);
		expect(types).toContain('import type { HandlerBuilder } from "@implementjs/kit/endpoint";');
		expect(types).toContain("export const handler: HandlerBuilder<ServerParams>;");
	});

	it("is absent from a page's $types, so nothing can import it from there", () => {
		const types = generateRouteTypes(slugNode, { layoutFiles: [], pageFiles: [] }, PATHS);
		expect(types).not.toContain("handler");
		expect(types).not.toContain("@implementjs/kit/endpoint");
	});

	it("is on every extension endpoint's $types", () => {
		const types = generateExtensionTypes(slugNode, PATHS);
		expect(types).toContain("export const handler: HandlerBuilder<ServerParams>;");
		expect(types).toContain('export type ServerParams = { "slug": string };');
	});
});

describe("generateRouterDeclaration", () => {
	it("declares the virtual router module with every page pattern", () => {
		const declaration = generateRouterDeclaration(
			[
				{ pattern: "/", params: [] },
				{ pattern: "/docs/:...slug", params: [{ name: "slug", matcher: null }] },
			],
			PATHS,
		);
		expect(declaration).toContain('declare module "$implement/router"');
		expect(declaration).toContain('"/": (params: {}) => Child;');
		expect(declaration).toContain(
			'"/docs/:...slug": (params: { "slug": Readable<string> }) => Child;',
		);
		expect(declaration).toContain('declare module "$implement/pages"');
		expect(declaration).toContain('declare module "$implement/hooks"');
	});

	it("declares $implement/navigation, so invalidate() type-checks in an app", () => {
		const declaration = generateRouterDeclaration([{ pattern: "/", params: [] }], PATHS);
		expect(declaration).toContain('declare module "$implement/navigation"');
		expect(declaration).toContain(
			'export { invalidate, invalidateAll } from "@implementjs/kit/runtime";',
		);
	});

	it("declares the error boundaries beside the pages, since the pipeline runs their loads", () => {
		const declaration = generateRouterDeclaration([{ pattern: "/", params: [] }], PATHS);
		expect(declaration).toContain(
			'import type { ErrorRoute, PageRoute } from "@implementjs/kit/server";',
		);
		expect(declaration).toContain("export const errors: ErrorRoute[];");
	});
});

describe("App.Api", () => {
	const routes = [{ pattern: "/", params: [] }];

	it("merges the generated client in, keyed off the app's own route table", () => {
		const declaration = generateRouterDeclaration(routes, PATHS);
		expect(declaration).toContain("declare namespace App {");
		expect(declaration).toContain(
			'type GeneratedApi = import("@implementjs/kit/client").TypedClient<import("../client.ts").Api>;',
		);
	});

	it("names the client before extending it, since an interface may only extend a name", () => {
		const declaration = generateRouterDeclaration(routes, PATHS);
		// `interface Api extends import("…").Client<…> {}` is TS2499, which
		// `skipLibCheck` hides — leaving `App.Api` empty and `event.api` useless
		expect(declaration).toContain("interface Api extends GeneratedApi {}");
		expect(declaration).not.toContain("interface Api extends import(");
	});

	it("follows the app's chosen error style", () => {
		expect(generateRouterDeclaration(routes, PATHS, { errors: "neverthrow" })).toContain(
			'import("@implementjs/kit/client/neverthrow").ResultClient<import("../client.ts").Api>',
		);
		expect(
			generateRouterDeclaration(routes, PATHS, { errors: "throw", style: "nested" }),
		).toContain(
			'import("@implementjs/kit/client").NestedClient<import("../client.ts").Api, import("@implementjs/kit/client").ThrowWrapper>',
		);
	});

	it("declares an empty base, so App.Api resolves before anything generates", () => {
		expect(generateAppDeclaration()).toContain("interface Api {}");
	});
});

describe("generateTsconfig", () => {
	it("maps each alias to root-relative exact and glob paths", () => {
		const tsconfig = JSON.parse(
			generateTsconfig({ "@/lib": "src/lib", "@/content": "src/content/" }),
		) as { compilerOptions: { paths: Record<string, string[]> } };
		expect(tsconfig.compilerOptions.paths).toEqual({
			"$implement/client": ["./client.ts"],
			"@/lib": ["../src/lib"],
			"@/lib/*": ["../src/lib/*"],
			"@/content": ["../src/content"],
			"@/content/*": ["../src/content/*"],
		});
	});

	it("skips the glob entry for file targets", () => {
		const tsconfig = JSON.parse(generateTsconfig({ "@utils": "src/lib/utils.ts" })) as {
			compilerOptions: { paths: Record<string, string[]> };
		};
		expect(tsconfig.compilerOptions.paths).toEqual({
			"$implement/client": ["./client.ts"],
			"@utils": ["../src/lib/utils.ts"],
		});
	});
});

describe("routerAliases", () => {
	it("points both halves at a file that is there", () => {
		const { vite, tsconfig } = routerAliases();

		// resolvable from kit, which is the whole point: an app that never depended on
		// the router still has somewhere for `$implement/router` to import it from
		expect(existsSync(vite[ROUTER_PACKAGE]!)).toBe(true);
		expect(existsSync(tsconfig[ROUTER_PACKAGE]!)).toBe(true);
	});

	it("declares the router to TypeScript, so the ParamTypes augmentation resolves", () => {
		const app = makeApp(["page.ts"]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));
		const generated = JSON.parse(readFileSync(join(app, ".implement/tsconfig.json"), "utf8")) as {
			compilerOptions: { paths: Record<string, string[]> };
		};

		expect(generated.compilerOptions.paths[ROUTER_PACKAGE]).toEqual([
			routerAliases().tsconfig[ROUTER_PACKAGE],
		]);
	});
});

describe("writeGenerated", () => {
	it("writes entries, tsconfig, and per-route $types", () => {
		const app = makeApp(["page.ts", "layout.ts", "docs/[...slug]/page.ts"]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));

		expect(readFileSync(join(app, ".implement/entry-client.ts"), "utf8")).toContain(
			'from "$implement/router"',
		);
		expect(readFileSync(join(app, ".implement/entry-server.ts"), "utf8")).toContain(
			"renderToString",
		);
		expect(readFileSync(join(app, ".implement/tsconfig.json"), "utf8")).toContain("rootDirs");
		expect(readFileSync(join(app, ".implement/.gitignore"), "utf8")).toBe("*\n");
		// the client always generates, even for an app with no endpoints at all
		expect(readFileSync(join(app, ".implement/client.ts"), "utf8")).toContain(
			"export const api: TypedClient<Api> = createClient();",
		);
		expect(existsSync(join(app, ".implement/types/src/routes/$types.d.ts"))).toBe(true);
		expect(existsSync(join(app, ".implement/types/src/routes/docs/[...slug]/$types.d.ts"))).toBe(
			true,
		);
	});

	it("writes $types for server-only and extension-endpoint directories", () => {
		const app = makeApp([
			"page.ts",
			"page.server.ts",
			"layout.server.ts",
			"docs/.md/server.ts",
			"docs/page.ts",
			"api/server.ts",
		]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));

		const rootTypes = readFileSync(join(app, ".implement/types/src/routes/$types.d.ts"), "utf8");
		expect(rootTypes).toContain(
			'export type PageData = Merge<Merge<{}, LoadData<typeof import("./layout.server.ts").default>>, LoadData<typeof import("./page.server.ts").default>>;',
		);
		expect(existsSync(join(app, ".implement/types/src/routes/api/$types.d.ts"))).toBe(true);
		const extensionTypes = readFileSync(
			join(app, ".implement/types/src/routes/docs/.md/$types.d.ts"),
			"utf8",
		);
		expect(extensionTypes).toContain("export type RequestEvent =");
	});

	it("declares the server-only virtual modules", () => {
		const app = makeApp(["page.ts"]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));
		const declaration = readFileSync(join(app, ".implement/types/$implement.d.ts"), "utf8");
		expect(declaration).toContain('declare module "$implement/pages"');
		expect(declaration).toContain('declare module "$implement/endpoints"');
	});

	it("says so when the neverthrow style is picked without the package", () => {
		const app = makeApp(["page.ts"]);
		const tree = scanRoutes(join(app, "src/routes"));
		expect(() => writeGenerated(app, tree, { client: { errors: "neverthrow" } })).toThrow(
			/`neverthrow` package is not installed/,
		);
		// nothing half-generated: the check runs before anything is written
		expect(existsSync(join(app, ".implement/client.ts"))).toBe(false);

		// the other two styles never need it
		expect(() => writeGenerated(app, tree, { client: { errors: "throw" } })).not.toThrow();
	});

	it("generates the neverthrow client once the package resolves", () => {
		const app = makeApp(["page.ts"]);
		const installed = join(app, "node_modules/neverthrow");
		mkdirSync(installed, { recursive: true });
		writeFileSync(join(installed, "package.json"), '{ "name": "neverthrow", "main": "index.js" }');
		writeFileSync(join(installed, "index.js"), "export {};\n");

		writeGenerated(app, scanRoutes(join(app, "src/routes")), {
			client: { errors: "neverthrow" },
		});
		expect(readFileSync(join(app, ".implement/client.ts"), "utf8")).toContain(
			"export const api: ResultClient<Api> = createClient();",
		);
	});

	it("writes the ParamTypes augmentation only while the app has matchers", () => {
		const app = makeApp(["page.ts", "posts/[id=integer]/page.ts"]);
		const routesDir = join(app, "src/routes");
		const paramsDir = join(app, "src/params");
		mkdirSync(paramsDir, { recursive: true });
		writeFileSync(join(paramsDir, "integer.ts"), "export default null;\n");
		const augmentation = join(app, ".implement/types/$implement-params.d.ts");

		writeGenerated(app, scanRoutes(routesDir, paramsDir));
		expect(readFileSync(augmentation, "utf8")).toContain('declare module "@implementjs/router"');

		// left behind, it augments the registry with a matcher module that is gone
		rmSync(join(routesDir, "posts"), { recursive: true });
		rmSync(paramsDir, { recursive: true });
		writeGenerated(app, scanRoutes(routesDir, paramsDir));
		expect(existsSync(augmentation)).toBe(false);
	});

	it("prunes $types for removed routes", () => {
		const app = makeApp(["page.ts", "docs/page.ts"]);
		const routesDir = join(app, "src/routes");
		writeGenerated(app, scanRoutes(routesDir));
		const stale = join(app, ".implement/types/src/routes/docs/$types.d.ts");
		expect(existsSync(stale)).toBe(true);

		rmSync(join(routesDir, "docs"), { recursive: true });
		writeGenerated(app, scanRoutes(routesDir));
		expect(existsSync(stale)).toBe(false);
	});
});
