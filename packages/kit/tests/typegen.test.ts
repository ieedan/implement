import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("generateRouteTypes", () => {
	it("types params as Readables", () => {
		const types = generateRouteTypes({
			dir: "docs/[...slug]",
			segment: { kind: "rest", name: "slug" },
			params: ["slug"],
			page: "docs/[...slug]/index.ts",
			pageResetTo: null,
			layout: null,
			layoutResetTo: null,
			children: [],
		});
		expect(types).toContain('export type RouteParams = { "slug": Readable<string> };');
		expect(types).toContain("export type PageProps = { params: RouteParams;");
		expect(types).toContain("children: Mountable");
	});
});

describe("generateRouterDeclaration", () => {
	it("declares the virtual router module with every page pattern", () => {
		const declaration = generateRouterDeclaration([
			{ pattern: "/", params: [] },
			{ pattern: "/docs/:...slug", params: ["slug"] },
		]);
		expect(declaration).toContain('declare module "$implement/router"');
		expect(declaration).toContain('"/": (params: {}) => Child;');
		expect(declaration).toContain(
			'"/docs/:...slug": (params: { "slug": Readable<string> }) => Child;',
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
