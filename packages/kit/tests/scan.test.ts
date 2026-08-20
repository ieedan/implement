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
	it("classifies static, param, and rest directories", () => {
		expect(parseSegment("docs")).toEqual({ kind: "static", value: "docs" });
		expect(parseSegment("[id]")).toEqual({ kind: "param", name: "id" });
		expect(parseSegment("[...slug]")).toEqual({ kind: "rest", name: "slug" });
	});

	it("rejects malformed names", () => {
		expect(() => parseSegment("[]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("[...]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("[id")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("id]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("a:b")).toThrow(/reserved/);
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
});
