import { describe, expect, it } from "vitest";
import { generateRouterModule } from "../src/codegen.ts";
import type { RouteNode, RouteTree } from "../src/scan.ts";

function node(partial: Partial<RouteNode>): RouteNode {
	return {
		dir: "",
		segment: null,
		params: [],
		page: null,
		pageResetTo: null,
		layout: null,
		layoutResetTo: null,
		children: [],
		...partial,
	};
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

	it("wires the root error page as the fallback, passing the error", () => {
		expect(code).toContain("fallback: (error) =>");
		expect(code).toContain("({ error, url: router.location })");
		expect(code).toContain('from "/src/routes/error.ts"');
	});

	it("omits the fallback without an error page", () => {
		const withoutError = generateRouterModule({ ...tree, error: null }, "/src/routes");
		expect(withoutError).not.toContain("fallback");
	});

	it("emits (group) directories as pathless group keys", () => {
		const grouped: RouteTree = {
			root: node({
				layout: "layout.ts",
				children: [
					node({
						dir: "(app)",
						segment: { kind: "group", name: "app" },
						layout: "(app)/layout.ts",
						children: [
							node({
								dir: "(app)/dashboard",
								segment: { kind: "static", value: "dashboard" },
								page: "(app)/dashboard/index.ts",
							}),
						],
					}),
				],
			}),
			error: null,
		};
		const code = generateRouterModule(grouped, "/src/routes");
		expect(code).toContain('"/(app)":');
		expect(code).toContain('from "/src/routes/(app)/layout.ts"');
		expect(code).toContain('"/dashboard":');
	});

	it("hoists an index@ page to its reset target", () => {
		const reset: RouteTree = {
			root: node({
				layout: "layout.ts",
				children: [
					node({
						dir: "dashboard",
						segment: { kind: "static", value: "dashboard" },
						layout: "dashboard/layout.ts",
						children: [
							node({
								dir: "dashboard/print",
								segment: { kind: "static", value: "print" },
								page: "dashboard/print/index@.ts",
								pageResetTo: "",
							}),
						],
					}),
				],
			}),
			error: null,
		};
		const code = generateRouterModule(reset, "/src/routes");
		// the page lands at the root under its full path, escaping dashboard's layout
		expect(code).toContain('"/dashboard/print/(@reset)":');
		expect(code).toContain('from "/src/routes/dashboard/print/index@.ts"');
	});

	it("hoists a layout@ subtree to its reset target", () => {
		const reset: RouteTree = {
			root: node({
				layout: "layout.ts",
				children: [
					node({
						dir: "(app)",
						segment: { kind: "group", name: "app" },
						layout: "(app)/layout.ts",
						children: [
							node({
								dir: "(app)/admin",
								segment: { kind: "static", value: "admin" },
								layout: "(app)/admin/layout@.ts",
								layoutResetTo: "",
								page: "(app)/admin/index.ts",
							}),
						],
					}),
				],
			}),
			error: null,
		};
		const code = generateRouterModule(reset, "/src/routes");
		// the subtree attaches at the root — the group key keeps matching pathless
		expect(code).toContain('"/(app)/admin":');
		expect(code).toContain('from "/src/routes/(app)/admin/layout@.ts"');
	});
});
