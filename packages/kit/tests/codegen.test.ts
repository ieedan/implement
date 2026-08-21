import { describe, expect, it } from "vitest";
import {
	dataChains,
	generateEndpointsModule,
	generatePagesModule,
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

	it("declares route modules as lazy handles, never static imports", () => {
		expect(code).toContain(
			'lazyModule("src/routes/index.ts", () => import("/src/routes/index.ts"))',
		);
		expect(code).toContain(
			'lazyModule("src/routes/docs/[...slug]/index.ts", () => import("/src/routes/docs/[...slug]/index.ts"))',
		);
		// nothing under the routes dir may be statically imported, or Rollup
		// pulls the whole app back into one chunk — the error page aside
		const staticImports = [...code.matchAll(/^import .* from "(\/src\/routes\/[^"]+)";$/gm)];
		expect(staticImports.map((match) => match[1])).toEqual(["/src/routes/error.ts"]);
	});

	it("adapts pages and layouts onto the core Router", () => {
		expect(code).toContain('import { Router } from "@implementjs/core"');
		expect(code).toContain(".get()({ params, url: router.location, data: routeData([]) })");
		expect(code).toContain(
			".get()({ children, params, url: router.location, data: routeData([]) })",
		);
		expect(code).toContain('"/docs":');
		expect(code).toContain('"/:...slug":');
	});

	it("lists each route's page and layout chain for the runtime to preload", () => {
		expect(code).toContain("registerRouteModules(");
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Parsing back the manifest the generator just emitted.
		const registered = JSON.parse(/registerRouteModules\((\[[\s\S]*?\n\])\);/.exec(code)![1]!) as {
			pattern: string;
			modules: string[];
		}[];
		expect(registered).toEqual([
			{ pattern: "/", modules: ["src/routes/layout.ts", "src/routes/index.ts"] },
			{ pattern: "/docs", modules: ["src/routes/layout.ts", "src/routes/docs/index.ts"] },
			{
				pattern: "/docs/:...slug",
				modules: ["src/routes/layout.ts", "src/routes/docs/[...slug]/index.ts"],
			},
		]);
	});

	it("registers no client routes when nothing loads", () => {
		expect(code).not.toContain("registerRoutes");
	});

	it("wires the root error page as the fallback, passing the error", () => {
		expect(code).toContain("fallback: (error) =>");
		expect(code).toContain("({ error, url: router.location })");
		// statically imported: it renders unmatched paths, so no route match
		// can be what pulls it in
		expect(code).toContain('import ErrorPage_4 from "/src/routes/error.ts";');
		expect(code).not.toContain('lazyModule("src/routes/error.ts"');
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
		expect(code).toContain('import("/src/routes/(app)/layout.ts")');
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
		expect(code).toContain('import("/src/routes/dashboard/print/index@.ts")');
		// and the reset drops dashboard's layout from what the route preloads
		expect(code).toContain(
			'"modules": [\n\t\t\t"src/routes/layout.ts",\n\t\t\t"src/routes/dashboard/print/index@.ts"\n\t\t]',
		);
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
		expect(code).toContain('import("/src/routes/(app)/admin/layout@.ts")');
		// the reset skips (app)'s layout, so admin's page never preloads it
		expect(code).toContain(
			'"modules": [\n\t\t\t"src/routes/layout.ts",\n\t\t\t"src/routes/(app)/admin/layout@.ts",\n\t\t\t"src/routes/(app)/admin/index.ts"\n\t\t]',
		);
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
		expect(code).toContain(
			'import { lazyModule, registerRouteModules, registerRoutes, routeData } from "@implementjs/kit/runtime"',
		);
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

describe("generatePagesModule", () => {
	const code = generatePagesModule(loaded, "/src/routes");

	it("imports each load once and lists every page with its chain", () => {
		expect(code).toContain('import load_0 from "/src/routes/layout.server.ts"');
		expect(code).toContain('import load_1 from "/src/routes/docs/index.server.ts"');
		expect(code).toContain(
			'{ pattern: "/", id: "/", files: [{ id: "layout.server.ts", load: load_0 }] }',
		);
		expect(code).toContain(
			'{ pattern: "/docs", id: "/docs", files: [{ id: "layout.server.ts", load: load_0 }, { id: "docs/index.server.ts", load: load_1 }] }',
		);
	});

	it("gives every page a route id, params in directory form", () => {
		expect(code).toContain('pattern: "/docs/:...slug", id: "/docs/[...slug]"');
	});
});

describe("generateEndpointsModule", () => {
	const code = generateEndpointsModule(loaded, "/src/routes");

	it("imports each endpoint namespace with its pattern and extension", () => {
		expect(code).toContain('import * as endpoint_0 from "/src/routes/docs/.md/server.ts"');
		expect(code).toContain(
			'{ pattern: "/docs", id: "/docs/.md", extension: ".md", file: "docs/.md/server.ts", module: endpoint_0 }',
		);
		expect(code).toContain(
			'{ pattern: "/api", id: "/api", extension: null, file: "api/server.ts", module: endpoint_2 }',
		);
	});
});
