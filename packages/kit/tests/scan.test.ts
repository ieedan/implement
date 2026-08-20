import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pageRoutes, staticRoutePaths } from "../src/codegen.ts";
import { parseSegment, scanRoutes } from "../src/scan.ts";

let dir: string | null = null;

function makeRoutes(files: string[]): string {
	dir = mkdtempSync(join(tmpdir(), "implement-kit-"));
	for (const file of files) {
		const path = join(dir, file);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, "export default () => null;\n");
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
		expect(parseSegment("[id]")).toEqual({ kind: "param", name: "id" });
		expect(parseSegment("[...slug]")).toEqual({ kind: "rest", name: "slug" });
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
	it("collects pages, layouts, and the root error file", () => {
		const tree = scanRoutes(
			makeRoutes([
				"index.ts",
				"layout.ts",
				"error.ts",
				"docs/index.ts",
				"docs/layout.ts",
				"docs/[...slug]/index.ts",
				"users/[id]/index.ts",
			]),
		);
		expect(tree.error).toBe("error.ts");
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/", params: [] },
			{ pattern: "/docs", params: [] },
			{ pattern: "/docs/:...slug", params: ["slug"] },
			{ pattern: "/users/:id", params: ["id"] },
		]);
		expect(staticRoutePaths(tree)).toEqual(["/", "/docs"]);
	});

	it("ignores colocated files and dot-directories", () => {
		const tree = scanRoutes(
			makeRoutes(["index.ts", "components.ts", "docs/helpers.ts", ".hidden/index.ts"]),
		);
		expect(pageRoutes(tree)).toEqual([{ pattern: "/", params: [] }]);
	});

	it("rejects nested routes inside a catch-all directory", () => {
		expect(() =>
			scanRoutes(makeRoutes(["docs/[...slug]/index.ts", "docs/[...slug]/deeper/index.ts"])),
		).toThrow(/cannot contain nested routes/);
	});

	it("allows a layout inside a catch-all directory", () => {
		const tree = scanRoutes(makeRoutes(["docs/[...slug]/index.ts", "docs/[...slug]/layout.ts"]));
		expect(pageRoutes(tree)).toEqual([{ pattern: "/docs/:...slug", params: ["slug"] }]);
	});

	it("rejects duplicate param names along a path", () => {
		expect(() => scanRoutes(makeRoutes(["[id]/nested/[id]/index.ts"]))).toThrow(
			/Duplicate route param/,
		);
	});

	it("rejects error.ts outside the routes root", () => {
		expect(() => scanRoutes(makeRoutes(["docs/error.ts"]))).toThrow(/routes root/);
	});

	it("collects load files next to their page and layout", () => {
		const tree = scanRoutes(
			makeRoutes(["index.ts", "index.server.ts", "layout.ts", "layout.server.ts"]),
		);
		expect(tree.root.pageServer).toBe("index.server.ts");
		expect(tree.root.layoutServer).toBe("layout.server.ts");
	});

	it("collects endpoints and extension endpoints", () => {
		const tree = scanRoutes(
			makeRoutes([
				"index.ts",
				"api/server.ts",
				"docs/[...slug]/index.ts",
				"docs/[...slug]/.md/server.ts",
			]),
		);
		const api = tree.root.children.find((child) => child.dir === "api")!;
		expect(api.endpoint).toBe("api/server.ts");
		const slug = tree.root.children.find((child) => child.dir === "docs")!.children[0]!;
		expect(slug.extensions).toEqual([{ extension: ".md", file: "docs/[...slug]/.md/server.ts" }]);
	});

	it("keeps a directory holding only server files", () => {
		const tree = scanRoutes(makeRoutes(["index.ts", "api/server.ts"]));
		expect(tree.root.children).toHaveLength(1);
	});

	it("still skips dot-directories without a server.ts", () => {
		const tree = scanRoutes(makeRoutes(["index.ts", ".md/helpers.ts"]));
		expect(tree.root.extensions).toEqual([]);
		expect(tree.root.children).toHaveLength(0);
	});

	it("rejects an endpoint sharing a directory with a page", () => {
		expect(() => scanRoutes(makeRoutes(["docs/index.ts", "docs/server.ts"]))).toThrow(
			/a page or an endpoint/,
		);
	});

	it("rejects an index.server.ts without an index.ts", () => {
		expect(() => scanRoutes(makeRoutes(["index.ts", "docs/index.server.ts"]))).toThrow(
			/no "docs\/index.ts" page/,
		);
	});

	it("rejects endpoints that collide with pages through groups", () => {
		expect(() => scanRoutes(makeRoutes(["(a)/about/index.ts", "about/server.ts"]))).toThrow(
			/both resolve to "\/about"/,
		);
	});

	it("excludes (group) directories from URL patterns", () => {
		const tree = scanRoutes(
			makeRoutes([
				"(marketing)/index.ts",
				"(marketing)/about/index.ts",
				"(authed)/layout.ts",
				"(authed)/dashboard/index.ts",
				"(authed)/dashboard/[id]/index.ts",
			]),
		);
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/dashboard", params: [] },
			{ pattern: "/dashboard/:id", params: ["id"] },
			{ pattern: "/", params: [] },
			{ pattern: "/about", params: [] },
		]);
		expect(staticRoutePaths(tree)).toEqual(["/dashboard", "/", "/about"]);
	});

	it("rejects pages that collide through groups", () => {
		expect(() => scanRoutes(makeRoutes(["(a)/about/index.ts", "about/index.ts"]))).toThrow(
			/both resolve to "\/about"/,
		);
		expect(() => scanRoutes(makeRoutes(["(a)/index.ts", "(b)/index.ts"]))).toThrow(
			/both resolve to "\/"/,
		);
	});

	it("records @ layout resets on pages and layouts", () => {
		const tree = scanRoutes(
			makeRoutes([
				"layout.ts",
				"(authed)/layout.ts",
				"(authed)/dashboard/index@.ts",
				"(authed)/settings/index@(authed).ts",
				"(authed)/admin/layout@.ts",
				"(authed)/admin/index.ts",
			]),
		);
		const authed = tree.root.children[0]!;
		const [admin, dashboard, settings] = authed.children;
		expect(dashboard!.page).toBe("(authed)/dashboard/index@.ts");
		expect(dashboard!.pageResetTo).toBe("");
		expect(settings!.pageResetTo).toBe("(authed)");
		expect(admin!.layout).toBe("(authed)/admin/layout@.ts");
		expect(admin!.layoutResetTo).toBe("");
		// resets do not change URL patterns
		expect(staticRoutePaths(tree)).toEqual(["/admin", "/dashboard", "/settings"]);
	});

	it("rejects a reset targeting a segment that is not an ancestor", () => {
		expect(() => scanRoutes(makeRoutes(["docs/index@(missing).ts"]))).toThrow(
			/no ancestor segment "\(missing\)"/,
		);
		// a layout cannot target its own directory
		expect(() => scanRoutes(makeRoutes(["(a)/layout@(a).ts"]))).toThrow(/no ancestor segment/);
	});

	it("rejects a root layout reset", () => {
		expect(() => scanRoutes(makeRoutes(["layout@.ts"]))).toThrow(/nothing to reset/);
	});

	it("rejects conflicting page or layout declarations in one directory", () => {
		expect(() => scanRoutes(makeRoutes(["docs/index.ts", "docs/index@.ts"]))).toThrow(
			/declares one page/,
		);
		expect(() => scanRoutes(makeRoutes(["docs/layout.ts", "docs/layout@.ts"]))).toThrow(
			/declares one layout/,
		);
	});
});
