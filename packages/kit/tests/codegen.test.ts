import { describe, expect, it } from "vitest";
import { generateRouterModule } from "../src/codegen.ts";
import type { RouteNode, RouteTree } from "../src/scan.ts";

function node(partial: Partial<RouteNode>): RouteNode {
	return { dir: "", segment: null, params: [], page: null, layout: null, children: [], ...partial };
}

const tree: RouteTree = {
	root: node({
		page: "index.ts",
		layout: "layout.ts",
		children: [
			node({
				dir: "docs",
				segment: { kind: "static", value: "docs" },
				page: "docs/index.ts",
				children: [
					node({
						dir: "docs/[...slug]",
						segment: { kind: "rest", name: "slug" },
						params: ["slug"],
						page: "docs/[...slug]/index.ts",
					}),
				],
			}),
		],
	}),
	error: "error.ts",
};

describe("generateRouterModule", () => {
	const code = generateRouterModule(tree, "/src/routes");

	it("imports route modules with root-relative ids", () => {
		expect(code).toContain('from "/src/routes/index.ts"');
		expect(code).toContain('from "/src/routes/docs/[...slug]/index.ts"');
	});

	it("adapts pages and layouts onto the core Router", () => {
		expect(code).toContain('import { Router } from "@implementjs/core"');
		expect(code).toContain("({ params, url: router.location })");
		expect(code).toContain("({ children, params, url: router.location })");
		expect(code).toContain('"/docs":');
		expect(code).toContain('"/:...slug":');
	});

	it("wires the root error page as the fallback", () => {
		expect(code).toContain("fallback: () =>");
		expect(code).toContain('from "/src/routes/error.ts"');
	});

	it("omits the fallback without an error page", () => {
		const withoutError = generateRouterModule({ ...tree, error: null }, "/src/routes");
		expect(withoutError).not.toContain("fallback");
	});
});
