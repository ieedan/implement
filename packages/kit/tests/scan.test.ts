import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { errorPatterns, pageRoutes, staticRoutePaths } from "../src/codegen.ts";
import {
	formatRouteWarning,
	importsLoadEvent,
	parseSegment,
	routeFileSuggestion,
	scanRoutes,
} from "../src/scan.ts";

let dir: string | null = null;

/**
 * A routes tree in a temp directory. A list of paths gets placeholder contents,
 * which is all the scan reads for most files; a map is for the one warning that
 * is about what a file says rather than about its name.
 */
function makeRoutes(files: string[] | Record<string, string>): string {
	dir = mkdtempSync(join(tmpdir(), "implement-kit-"));
	const entries = Array.isArray(files)
		? files.map((file) => [file, "export default () => null;\n"] as const)
		: Object.entries(files);
	for (const [file, source] of entries) {
		const path = join(dir, file);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, source);
	}
	return dir;
}

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

describe("parseSegment", () => {
	it("classifies static, param, rest, and group directories", () => {
		expect(parseSegment("docs")).toEqual({ kind: "static", value: "docs" });
		expect(parseSegment("[id]")).toEqual({ kind: "param", name: "id", matcher: null });
		expect(parseSegment("[...slug]")).toEqual({ kind: "rest", name: "slug", matcher: null });
		expect(parseSegment("(authed)")).toEqual({ kind: "group", name: "authed" });
	});

	it("rejects malformed names", () => {
		expect(() => parseSegment("[]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("[...]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("[id")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("id]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("a:b")).toThrow(/reserved/);
		expect(() => parseSegment("()")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("(authed")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("(au@thed)")).toThrow(/Invalid route directory/);
	});
});

describe("scanRoutes", () => {
	it("collects pages, layouts, and the root error page", () => {
		const tree = scanRoutes(
			makeRoutes([
				"page.ts",
				"layout.ts",
				"error.ts",
				"docs/page.ts",
				"docs/layout.ts",
				"docs/[...slug]/page.ts",
				"users/[id]/page.ts",
			]),
		);
		expect(tree.error).toBe("error.ts");
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/", params: [] },
			{ pattern: "/docs", params: [] },
			{ pattern: "/docs/:...slug", params: [{ name: "slug", matcher: null }] },
			{ pattern: "/users/:id", params: [{ name: "id", matcher: null }] },
		]);
		expect(staticRoutePaths(tree)).toEqual(["/", "/docs"]);
	});

	it("ignores colocated files and dot-directories", () => {
		const tree = scanRoutes(
			makeRoutes(["page.ts", "components.ts", "docs/helpers.ts", ".hidden/page.ts"]),
		);
		expect(pageRoutes(tree)).toEqual([{ pattern: "/", params: [] }]);
		expect(tree.warnings).toEqual([]);
	});

	it("warns about files that only just miss a routing name", () => {
		const tree = scanRoutes(
			makeRoutes([
				"page.ts",
				"api/+server.ts",
				"docs/page.tsx",
				"docs/+page.server.js",
				"about/+page.svelte",
			]),
		);
		expect(tree.warnings).toEqual([
			{ kind: "unknown-file", file: "about/+page.svelte", suggestion: "page.ts" },
			{ kind: "unknown-file", file: "api/+server.ts", suggestion: "server.ts" },
			{ kind: "unknown-file", file: "docs/+page.server.js", suggestion: "page.server.ts" },
			{ kind: "unknown-file", file: "docs/page.tsx", suggestion: "page.ts" },
		]);
		// the misnamed files route nothing, which is what the warning is for
		expect(pageRoutes(tree)).toEqual([{ pattern: "/", params: [] }]);
	});

	it("warns from a directory the scan drops for having no routes", () => {
		const tree = scanRoutes(makeRoutes(["page.ts", "api/+server.ts"]));
		expect(tree.root.children).toEqual([]);
		expect(tree.warnings).toEqual([
			{ kind: "unknown-file", file: "api/+server.ts", suggestion: "server.ts" },
		]);
	});

	it("warns about a layout.server.ts typed with LoadEvent", () => {
		const tree = scanRoutes(
			makeRoutes({
				"page.ts": "export default () => null;\n",
				"app/layout.ts": "export default () => null;\n",
				"app/layout.server.ts":
					'import type { LoadEvent } from "./$types";\n\nexport default async function load({ locals }: LoadEvent) {\n\treturn { user: locals.user };\n}\n',
			}),
		);
		expect(tree.warnings).toEqual([{ kind: "layout-load-event", file: "app/layout.server.ts" }]);
		// the file still loads for the layout — it compiles wrong, it does not route wrong
		expect(tree.root.children[0]!.layoutServer).toBe("app/layout.server.ts");
	});

	it("stays quiet for a layout.server.ts typed with LayoutLoadEvent", () => {
		const tree = scanRoutes(
			makeRoutes({
				"page.ts": "export default () => null;\n",
				"app/layout.ts": "export default () => null;\n",
				"app/layout.server.ts":
					'import type { LayoutLoadEvent } from "./$types";\n\nexport default async function load({ locals }: LayoutLoadEvent) {\n\treturn { user: locals.user };\n}\n',
				// the page's own load is where `LoadEvent` belongs
				"app/page.ts": "export default () => null;\n",
				"app/page.server.ts":
					'import type { LoadEvent } from "./$types";\n\nexport default async function load({ parent }: LoadEvent) {\n\treturn parent();\n}\n',
			}),
		);
		expect(tree.warnings).toEqual([]);
	});

	it("rejects nested routes inside a catch-all directory", () => {
		expect(() =>
			scanRoutes(makeRoutes(["docs/[...slug]/page.ts", "docs/[...slug]/deeper/page.ts"])),
		).toThrow(/cannot contain nested routes/);
	});

	it("allows a layout inside a catch-all directory", () => {
		const tree = scanRoutes(makeRoutes(["docs/[...slug]/page.ts", "docs/[...slug]/layout.ts"]));
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/docs/:...slug", params: [{ name: "slug", matcher: null }] },
		]);
	});

	it("rejects duplicate param names along a path", () => {
		expect(() => scanRoutes(makeRoutes(["[id]/nested/[id]/page.ts"]))).toThrow(
			/Duplicate route param/,
		);
	});

	it("collects an error.ts in any directory, scoped to that subtree", () => {
		const tree = scanRoutes(
			makeRoutes(["page.ts", "error.ts", "app/[slug]/page.ts", "app/[slug]/error.ts"]),
		);
		expect(tree.error).toBe("error.ts");
		expect(errorPatterns(tree)).toEqual([
			{ node: expect.objectContaining({ dir: "", error: "error.ts" }), pattern: "/" },
			{
				node: expect.objectContaining({ dir: "app/[slug]", error: "app/[slug]/error.ts" }),
				pattern: "/app/:slug",
			},
		]);
	});

	it("keeps a directory that holds nothing but an error.ts", () => {
		const tree = scanRoutes(makeRoutes(["page.ts", "settings/error.ts"]));
		expect(errorPatterns(tree).map((boundary) => boundary.pattern)).toEqual(["/settings"]);
	});

	it("collects load files next to their page and layout", () => {
		const tree = scanRoutes(
			makeRoutes(["page.ts", "page.server.ts", "layout.ts", "layout.server.ts"]),
		);
		expect(tree.root.pageServer).toBe("page.server.ts");
		expect(tree.root.layoutServer).toBe("layout.server.ts");
	});

	it("collects endpoints and extension endpoints", () => {
		const tree = scanRoutes(
			makeRoutes([
				"page.ts",
				"api/server.ts",
				"docs/[...slug]/page.ts",
				"docs/[...slug]/.md/server.ts",
			]),
		);
		const api = tree.root.children.find((child) => child.dir === "api")!;
		expect(api.endpoint).toBe("api/server.ts");
		const slug = tree.root.children.find((child) => child.dir === "docs")!.children[0]!;
		expect(slug.extensions).toEqual([{ extension: ".md", file: "docs/[...slug]/.md/server.ts" }]);
	});

	it("keeps a directory holding only server files", () => {
		const tree = scanRoutes(makeRoutes(["page.ts", "api/server.ts"]));
		expect(tree.root.children).toHaveLength(1);
	});

	it("still skips dot-directories without a server.ts", () => {
		const tree = scanRoutes(makeRoutes(["page.ts", ".md/helpers.ts"]));
		expect(tree.root.extensions).toEqual([]);
		expect(tree.root.children).toHaveLength(0);
	});

	it("rejects an endpoint sharing a directory with a page", () => {
		expect(() => scanRoutes(makeRoutes(["docs/page.ts", "docs/server.ts"]))).toThrow(
			/a page or an endpoint/,
		);
	});

	it("rejects a page.server.ts without a page.ts", () => {
		expect(() => scanRoutes(makeRoutes(["page.ts", "docs/page.server.ts"]))).toThrow(
			/no "docs\/page.ts" page/,
		);
	});

	it("rejects endpoints that collide with pages through groups", () => {
		expect(() => scanRoutes(makeRoutes(["(a)/about/page.ts", "about/server.ts"]))).toThrow(
			/both resolve to "\/about"/,
		);
	});

	it("excludes (group) directories from URL patterns", () => {
		const tree = scanRoutes(
			makeRoutes([
				"(marketing)/page.ts",
				"(marketing)/about/page.ts",
				"(authed)/layout.ts",
				"(authed)/dashboard/page.ts",
				"(authed)/dashboard/[id]/page.ts",
			]),
		);
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/dashboard", params: [] },
			{ pattern: "/dashboard/:id", params: [{ name: "id", matcher: null }] },
			{ pattern: "/", params: [] },
			{ pattern: "/about", params: [] },
		]);
		expect(staticRoutePaths(tree)).toEqual(["/dashboard", "/", "/about"]);
	});

	it("rejects pages that collide through groups", () => {
		expect(() => scanRoutes(makeRoutes(["(a)/about/page.ts", "about/page.ts"]))).toThrow(
			/both resolve to "\/about"/,
		);
		expect(() => scanRoutes(makeRoutes(["(a)/page.ts", "(b)/page.ts"]))).toThrow(
			/both resolve to "\/"/,
		);
	});

	it("records @ layout resets on pages and layouts", () => {
		const tree = scanRoutes(
			makeRoutes([
				"layout.ts",
				"(authed)/layout.ts",
				"(authed)/dashboard/page@.ts",
				"(authed)/settings/page@(authed).ts",
				"(authed)/admin/layout@.ts",
				"(authed)/admin/page.ts",
			]),
		);
		const authed = tree.root.children[0]!;
		const [admin, dashboard, settings] = authed.children;
		expect(dashboard!.page).toBe("(authed)/dashboard/page@.ts");
		expect(dashboard!.pageResetTo).toBe("");
		expect(settings!.pageResetTo).toBe("(authed)");
		expect(admin!.layout).toBe("(authed)/admin/layout@.ts");
		expect(admin!.layoutResetTo).toBe("");
		// resets do not change URL patterns
		expect(staticRoutePaths(tree)).toEqual(["/admin", "/dashboard", "/settings"]);
	});

	it("rejects a reset targeting a segment that is not an ancestor", () => {
		expect(() => scanRoutes(makeRoutes(["docs/page@(missing).ts"]))).toThrow(
			/no ancestor segment "\(missing\)"/,
		);
		// a layout cannot target its own directory
		expect(() => scanRoutes(makeRoutes(["(a)/layout@(a).ts"]))).toThrow(/no ancestor segment/);
	});

	it("rejects a root layout reset", () => {
		expect(() => scanRoutes(makeRoutes(["layout@.ts"]))).toThrow(/nothing to reset/);
	});

	it("rejects conflicting page or layout declarations in one directory", () => {
		expect(() => scanRoutes(makeRoutes(["docs/page.ts", "docs/page@.ts"]))).toThrow(
			/declares one page/,
		);
		expect(() => scanRoutes(makeRoutes(["docs/layout.ts", "docs/layout@.ts"]))).toThrow(
			/declares one layout/,
		);
	});
});

describe("routeFileSuggestion", () => {
	it("names the routing file a near miss was reaching for", () => {
		expect(routeFileSuggestion("+server.ts")).toBe("server.ts");
		expect(routeFileSuggestion("+page.ts")).toBe("page.ts");
		expect(routeFileSuggestion("+layout.svelte")).toBe("layout.ts");
		expect(routeFileSuggestion("+page.server.js")).toBe("page.server.ts");
		expect(routeFileSuggestion("layout.server.jsx")).toBe("layout.server.ts");
		expect(routeFileSuggestion("+error.ts")).toBe("error.ts");
		expect(routeFileSuggestion("+page@.ts")).toBe("page@.ts");
		expect(routeFileSuggestion("page@(authed).mjs")).toBe("page@(authed).ts");
	});

	it("stays quiet for routing files and for colocated code", () => {
		expect(routeFileSuggestion("page.ts")).toBe(null);
		expect(routeFileSuggestion("server.ts")).toBe(null);
		expect(routeFileSuggestion("layout@.ts")).toBe(null);
		expect(routeFileSuggestion("Button.ts")).toBe(null);
		expect(routeFileSuggestion("page.test.ts")).toBe(null);
		// an asset named after its route is not a misnamed route
		expect(routeFileSuggestion("layout.css")).toBe(null);
		expect(routeFileSuggestion("page.md")).toBe(null);
		expect(routeFileSuggestion(".gitkeep")).toBe(null);
		expect(routeFileSuggestion("server")).toBe(null);
	});
});

describe("importsLoadEvent", () => {
	it("recognizes every spelling of the import that goes wrong", () => {
		expect(importsLoadEvent('import type { LoadEvent } from "./$types";')).toBe(true);
		expect(importsLoadEvent("import type { LoadEvent } from './$types';")).toBe(true);
		expect(importsLoadEvent('import { type LoadEvent } from "./$types";')).toBe(true);
		expect(importsLoadEvent('import type {LoadEvent} from "./$types"')).toBe(true);
		expect(importsLoadEvent('import type { LoadEvent as Event } from "./$types";')).toBe(true);
		expect(importsLoadEvent('import type { RequestEvent, LoadEvent } from "./$types";')).toBe(true);
		expect(importsLoadEvent('import type {\n\tLoadEvent,\n} from "./$types";')).toBe(true);
	});

	it("leaves the right import, and the same name from elsewhere, alone", () => {
		// the fix for the warning is this one word, so it had better not warn too
		expect(importsLoadEvent('import type { LayoutLoadEvent } from "./$types";')).toBe(false);
		expect(importsLoadEvent('import type { PageProps } from "./$types";')).toBe(false);
		// a `LoadEvent` that is not the route's own is not the route's problem
		expect(importsLoadEvent('import type { LoadEvent } from "@implementjs/kit/server";')).toBe(
			false,
		);
		expect(importsLoadEvent('import type { LayoutLoadEvent as LoadEvent } from "./$types";')).toBe(
			false,
		);
		expect(importsLoadEvent("export default async function load() {}")).toBe(false);
	});
});

describe("formatRouteWarning", () => {
	it("points at the file it found and the name it wanted", () => {
		const message = formatRouteWarning(
			{ kind: "unknown-file", file: "api/+server.ts", suggestion: "server.ts" },
			"src/routes",
		);
		expect(message).toContain('unknown file "src/routes/api/+server.ts"');
		expect(message).toContain('did you mean "server.ts"?');
	});

	it("names LayoutLoadEvent, which the TS2502 it explains never does", () => {
		const message = formatRouteWarning(
			{ kind: "layout-load-event", file: "app/layout.server.ts" },
			"src/routes",
		);
		expect(message).toContain('"src/routes/app/layout.server.ts"');
		expect(message).toContain("LayoutLoadEvent");
		expect(message).toContain("TS2502");
	});
});
