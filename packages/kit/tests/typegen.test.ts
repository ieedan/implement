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

const slugNode = {
	dir: "docs/[...slug]",
	segment: { kind: "rest", name: "slug" } as const,
	params: ["slug"],
	page: "docs/[...slug]/page.ts",
	pageResetTo: null,
	layout: null,
	layoutResetTo: null,
	pageServer: null,
	layoutServer: null,
	endpoint: null,
	extensions: [],
	children: [],
};

describe("generateRouteTypes", () => {
	it("types params as Readables and server params as strings", () => {
		const types = generateRouteTypes(slugNode, { layoutFiles: [], pageFiles: [] });
		expect(types).toContain('export type RouteParams = { "slug": Readable<string> };');
		expect(types).toContain('export type ServerParams = { "slug": string };');
		expect(types).toContain("export type LoadEvent = KitRequestEvent<ServerParams>;");
		expect(types).toContain("export type RequestEvent = KitRequestEvent<ServerParams>;");
		expect(types).toContain("export type PageProps = { params: RouteParams;");
		expect(types).toContain("data: Readable<PageData>");
		expect(types).toContain("children: Mountable");
	});

	it("types data as the merged load chain", () => {
		const types = generateRouteTypes(slugNode, {
			layoutFiles: ["layout.server.ts"],
			pageFiles: ["layout.server.ts", "docs/[...slug]/page.server.ts"],
		});
		expect(types).toContain(
			'export type LayoutData = Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>;',
		);
		expect(types).toContain(
			'export type PageData = Merge<Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>, LoadData<typeof import("../../docs/[...slug]/page.server.ts").default>>;',
		);
	});
});

describe("the handler export", () => {
	const endpointNode = { ...slugNode, page: null, endpoint: "docs/[...slug]/server.ts" };

	it("is on an endpoint directory's $types, bound to that route's params", () => {
		const types = generateRouteTypes(endpointNode, { layoutFiles: [], pageFiles: [] });
		expect(types).toContain('import type { HandlerBuilder } from "@implementjs/kit/endpoint";');
		expect(types).toContain("export const handler: HandlerBuilder<ServerParams>;");
	});

	it("is absent from a page's $types, so nothing can import it from there", () => {
		const types = generateRouteTypes(slugNode, { layoutFiles: [], pageFiles: [] });
		expect(types).not.toContain("handler");
		expect(types).not.toContain("@implementjs/kit/endpoint");
	});

	it("is on every extension endpoint's $types", () => {
		const types = generateExtensionTypes(slugNode);
		expect(types).toContain("export const handler: HandlerBuilder<ServerParams>;");
		expect(types).toContain('export type ServerParams = { "slug": string };');
	});
});

describe("generateRouterDeclaration", () => {
	it("declares the virtual router module with every page pattern", () => {
		const declaration = generateRouterDeclaration(
			[
				{ pattern: "/", params: [] },
				{ pattern: "/docs/:...slug", params: ["slug"] },
			],
			false,
		);
		expect(declaration).toContain('declare module "$implement/router"');
		expect(declaration).toContain('"/": (params: {}) => Child;');
		expect(declaration).toContain(
			'"/docs/:...slug": (params: { "slug": Readable<string> }) => Child;',
		);
		expect(declaration).toContain('declare module "$implement/pages"');
		expect(declaration).toContain('declare module "$implement/hooks"');
	});

	it("declares the error page export only for an app that has one", () => {
		const routes = [{ pattern: "/", params: [] }];
		expect(generateRouterDeclaration(routes, false)).not.toContain("errorPage");
		expect(generateRouterDeclaration(routes, true)).toContain(
			"export function errorPage(error: RouterError): Child;",
		);
	});
});

describe("App.Api", () => {
	const routes = [{ pattern: "/", params: [] }];

	it("merges the generated client in, keyed off the app's own route table", () => {
		const declaration = generateRouterDeclaration(routes, false);
		expect(declaration).toContain("declare namespace App {");
		expect(declaration).toContain(
			'interface Api extends import("@implementjs/kit/client").TypedClient<import("../client.ts").Api> {}',
		);
	});

	it("follows the app's chosen error style", () => {
		expect(generateRouterDeclaration(routes, false, { errors: "neverthrow" })).toContain(
			'import("@implementjs/kit/client/neverthrow").ResultClient<import("../client.ts").Api>',
		);
		expect(generateRouterDeclaration(routes, false, { errors: "throw", nested: true })).toContain(
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
