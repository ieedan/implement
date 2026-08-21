import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test fixtures and generated output require intentional narrowing. */
import { afterEach, describe, expect, it } from "vitest";
import { scanRoutes } from "../src/scan.ts";
import {
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
	page: "docs/[...slug]/index.ts",
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
			pageFiles: ["layout.server.ts", "docs/[...slug]/index.server.ts"],
		});
		expect(types).toContain(
			'export type LayoutData = Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>;',
		);
		expect(types).toContain(
			'export type PageData = Merge<Merge<{}, LoadData<typeof import("../../layout.server.ts").default>>, LoadData<typeof import("../../docs/[...slug]/index.server.ts").default>>;',
		);
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

describe("generateTsconfig", () => {
	it("maps each alias to root-relative exact and glob paths", () => {
		const tsconfig = JSON.parse(
			generateTsconfig({ "@/lib": "src/lib", "@/content": "src/content/" }),
		) as { compilerOptions: { paths: Record<string, string[]> } };
		expect(tsconfig.compilerOptions.paths).toEqual({
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
		expect(tsconfig.compilerOptions.paths).toEqual({ "@utils": ["../src/lib/utils.ts"] });
	});
});

describe("writeGenerated", () => {
	it("writes entries, tsconfig, and per-route $types", () => {
		const app = makeApp(["index.ts", "layout.ts", "docs/[...slug]/index.ts"]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));

		expect(readFileSync(join(app, ".implement/entry-client.ts"), "utf8")).toContain(
			'from "$implement/router"',
		);
		expect(readFileSync(join(app, ".implement/entry-server.ts"), "utf8")).toContain(
			"renderToString",
		);
		expect(readFileSync(join(app, ".implement/tsconfig.json"), "utf8")).toContain("rootDirs");
		expect(readFileSync(join(app, ".implement/.gitignore"), "utf8")).toBe("*\n");
		expect(existsSync(join(app, ".implement/types/src/routes/$types.d.ts"))).toBe(true);
		expect(existsSync(join(app, ".implement/types/src/routes/docs/[...slug]/$types.d.ts"))).toBe(
			true,
		);
	});

	it("writes $types for server-only and extension-endpoint directories", () => {
		const app = makeApp([
			"index.ts",
			"index.server.ts",
			"layout.server.ts",
			"docs/.md/server.ts",
			"docs/index.ts",
			"api/server.ts",
		]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));

		const rootTypes = readFileSync(join(app, ".implement/types/src/routes/$types.d.ts"), "utf8");
		expect(rootTypes).toContain(
			'export type PageData = Merge<Merge<{}, LoadData<typeof import("./layout.server.ts").default>>, LoadData<typeof import("./index.server.ts").default>>;',
		);
		expect(existsSync(join(app, ".implement/types/src/routes/api/$types.d.ts"))).toBe(true);
		const extensionTypes = readFileSync(
			join(app, ".implement/types/src/routes/docs/.md/$types.d.ts"),
			"utf8",
		);
		expect(extensionTypes).toContain("export type RequestEvent =");
	});

	it("declares the server-only virtual modules", () => {
		const app = makeApp(["index.ts"]);
		writeGenerated(app, scanRoutes(join(app, "src/routes")));
		const declaration = readFileSync(join(app, ".implement/types/$implement.d.ts"), "utf8");
		expect(declaration).toContain('declare module "$implement/pages"');
		expect(declaration).toContain('declare module "$implement/endpoints"');
	});

	it("prunes $types for removed routes", () => {
		const app = makeApp(["index.ts", "docs/index.ts"]);
		const routesDir = join(app, "src/routes");
		writeGenerated(app, scanRoutes(routesDir));
		const stale = join(app, ".implement/types/src/routes/docs/$types.d.ts");
		expect(existsSync(stale)).toBe(true);

		rmSync(join(routesDir, "docs"), { recursive: true });
		writeGenerated(app, scanRoutes(routesDir));
		expect(existsSync(stale)).toBe(false);
	});
});
