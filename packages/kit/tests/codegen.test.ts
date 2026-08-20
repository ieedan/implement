import { describe, expect, it } from "vitest";
import {
	dataChains,
	generateEndpointsModule,
	generateLoadsModule,
	generateRouterModule,
	serverRoutes,
} from "../src/codegen.ts";
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
		pageServer: null,
		layoutServer: null,
		endpoint: null,
		extensions: [],
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
		expect(code).toContain("({ params, url: router.location, data: routeData([]) })");
		expect(code).toContain("({ children, params, url: router.location, data: routeData([]) })");
		expect(code).toContain('"/docs":');
		expect(code).toContain('"/:...slug":');
	});

	it("registers no client routes when nothing loads", () => {
		expect(code).not.toContain("registerRoutes");
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

const loaded: RouteTree = {
	root: node({
		page: "index.ts",
		layout: "layout.ts",
		layoutServer: "layout.server.ts",
		children: [
			node({
				dir: "docs",
				segment: { kind: "static", value: "docs" },
				page: "docs/index.ts",
				pageServer: "docs/index.server.ts",
				extensions: [{ extension: ".md", file: "docs/.md/server.ts" }],
				children: [
					node({
						dir: "docs/[...slug]",
						segment: { kind: "rest", name: "slug" },
						params: ["slug"],
						page: "docs/[...slug]/index.ts",
						extensions: [{ extension: ".md", file: "docs/[...slug]/.md/server.ts" }],
					}),
				],
			}),
			node({
				dir: "api",
				segment: { kind: "static", value: "api" },
				endpoint: "api/server.ts",
			}),
		],
	}),
	error: null,
};

describe("dataChains", () => {
	it("chains ancestor layout loads down to each page", () => {
		const chains = dataChains(loaded);
		expect(chains.get(loaded.root)!.pageFiles).toEqual(["layout.server.ts"]);
		const docs = loaded.root.children[0]!;
		expect(chains.get(docs)!.pageFiles).toEqual(["layout.server.ts", "docs/index.server.ts"]);
		expect(chains.get(docs)!.layoutFiles).toEqual(["layout.server.ts"]);
		expect(chains.get(docs.children[0]!)!.pageFiles).toEqual(["layout.server.ts"]);
	});

	it("resets the chain with an index@ page", () => {
		const reset: RouteTree = {
			root: node({
				layout: "layout.ts",
				layoutServer: "layout.server.ts",
				children: [
					node({
						dir: "dashboard",
						segment: { kind: "static", value: "dashboard" },
						layout: "dashboard/layout.ts",
						layoutServer: "dashboard/layout.server.ts",
						children: [
							node({
								dir: "dashboard/print",
								segment: { kind: "static", value: "print" },
								page: "dashboard/print/index@.ts",
								pageResetTo: "",
								pageServer: "dashboard/print/index.server.ts",
							}),
						],
					}),
				],
			}),
			error: null,
		};
		const chains = dataChains(reset);
		const print = reset.root.children[0]!.children[0]!;
		// the reset skips dashboard's layout load, keeping only the root's
		expect(chains.get(print)!.pageFiles).toEqual([
			"layout.server.ts",
			"dashboard/print/index.server.ts",
		]);
	});
});

describe("generateRouterModule with loads", () => {
	const code = generateRouterModule(loaded, "/src/routes");

	it("feeds each page and layout its chained data readable", () => {
		expect(code).toContain('data: routeData(["layout.server.ts"])');
		expect(code).toContain('data: routeData(["layout.server.ts","docs/index.server.ts"])');
	});

	it("registers the load-bearing routes with the client runtime", () => {
		expect(code).toContain('import { registerRoutes, routeData } from "@implementjs/kit/runtime"');
		expect(code).toContain("registerRoutes(");
		expect(code).toContain('"pattern": "/docs"');
		// the slug page inherits the root load, so it registers too
		expect(code).toContain('"pattern": "/docs/:...slug"');
	});

	it("never imports server files itself", () => {
		expect(code).not.toMatch(/import[^\n]*server\.ts/);
	});
});

describe("serverRoutes", () => {
	it("collects plain and extension endpoints with their patterns", () => {
		expect(serverRoutes(loaded)).toEqual([
			{ pattern: "/docs", extension: ".md", params: [], file: "docs/.md/server.ts" },
			{
				pattern: "/docs/:...slug",
				extension: ".md",
				params: ["slug"],
				file: "docs/[...slug]/.md/server.ts",
			},
			{ pattern: "/api", extension: null, params: [], file: "api/server.ts" },
		]);
	});
});

describe("generateLoadsModule", () => {
	const code = generateLoadsModule(loaded, "/src/routes");

	it("imports each load once and lists every load-bearing route", () => {
		expect(code).toContain('import load_0 from "/src/routes/layout.server.ts"');
		expect(code).toContain('import load_1 from "/src/routes/docs/index.server.ts"');
		expect(code).toContain('{ pattern: "/", files: [{ id: "layout.server.ts", load: load_0 }] }');
		expect(code).toContain(
			'{ pattern: "/docs", files: [{ id: "layout.server.ts", load: load_0 }, { id: "docs/index.server.ts", load: load_1 }] }',
		);
	});
});

describe("generateEndpointsModule", () => {
	const code = generateEndpointsModule(loaded, "/src/routes");

	it("imports each endpoint namespace with its pattern and extension", () => {
		expect(code).toContain('import * as endpoint_0 from "/src/routes/docs/.md/server.ts"');
		expect(code).toContain(
			'{ pattern: "/docs", extension: ".md", file: "docs/.md/server.ts", module: endpoint_0 }',
		);
		expect(code).toContain(
			'{ pattern: "/api", extension: null, file: "api/server.ts", module: endpoint_2 }',
		);
	});
});
