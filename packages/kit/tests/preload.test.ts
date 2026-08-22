import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { manifestPath, preloadHints } from "../src/preload.ts";
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
		page: "page.ts",
		layout: "layout.ts",
		children: [
			node({
				dir: "docs",
				segment: { kind: "static", value: "docs" },
				layout: "docs/layout.ts",
				children: [
					node({
						dir: "docs/[...slug]",
						segment: { kind: "rest", name: "slug", matcher: null },
						params: [{ name: "slug", matcher: null }],
						page: "docs/[...slug]/page.ts",
					}),
				],
			}),
		],
	}),
	error: "error.ts",
	matchers: [],
};

/** The shape Vite writes: keys are root-relative sources, `imports` are keys too. */
const manifest = {
	"src/routes/layout.ts": { file: "assets/layout-1.js", imports: ["_shared-9.js"] },
	"src/routes/page.ts": { file: "assets/home-2.js" },
	"src/routes/docs/layout.ts": {
		file: "assets/docs-layout-3.js",
		imports: ["_shared-9.js"],
		css: ["assets/docs-4.css"],
	},
	"src/routes/docs/[...slug]/page.ts": {
		file: "assets/docs-page-5.js",
		imports: ["_editor-6.js"],
	},
	"_editor-6.js": { file: "assets/editor-6.js" },
	"_shared-9.js": { file: "assets/shared-9.js" },
};

const shell = `<html>\n\t<head>\n\t\t<script type="module" crossorigin src="/assets/entry-0.js"></script>\n\t\t<link rel="modulepreload" crossorigin href="/assets/shared-9.js">\n\t</head>\n\t<body></body>\n</html>`;

describe("preloadHints", () => {
	let outDir: string;

	beforeAll(() => {
		outDir = mkdtempSync(join(tmpdir(), "implement-preload-"));
		mkdirSync(join(outDir, ".vite"));
		writeFileSync(join(outDir, ".vite/manifest.json"), JSON.stringify(manifest));
	});

	afterAll(() => {
		rmSync(outDir, { recursive: true, force: true });
	});

	const hints = () =>
		preloadHints({
			manifest: manifestPath(outDir, true),
			routesBase: "/src/routes",
			tree: () => tree,
		});

	it("preloads the route's own chunks and skips the ones the shell already links", () => {
		const html = hints()("/", shell);
		expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/layout-1.js">');
		expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/home-2.js">');
		// already preloaded by the shell as an entry import — no second tag
		expect(html.match(/assets\/shared-9\.js/g)).toHaveLength(1);
		// another route's chunks stay out of it
		expect(html).not.toContain("docs-page-5.js");
		expect(html).not.toContain("editor-6.js");
	});

	it("follows a chunk's transitive imports and links route-scoped css", () => {
		const html = hints()("/docs/foreach", shell);
		expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/docs-page-5.js">');
		// discovered only through the route chunk's own imports
		expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/editor-6.js">');
		expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/docs-4.css">');
		expect(html).toContain("</head>");
	});

	it("leaves a path matching no route untouched — the 404 fallback's case", () => {
		expect(hints()("/__implement__/not-found", shell)).toBe(shell);
	});

	it("leaves the page alone when the build wrote no manifest", () => {
		const off = preloadHints({ manifest: null, routesBase: "/src/routes", tree: () => tree });
		expect(off("/", shell)).toBe(shell);
	});
});

describe("manifestPath", () => {
	it("resolves Vite's default location, a custom name, and the off switch", () => {
		expect(manifestPath("/out", true)).toBe(join("/out", ".vite", "manifest.json"));
		expect(manifestPath("/out", "custom.json")).toBe(join("/out", "custom.json"));
		expect(manifestPath("/out", false)).toBeNull();
	});
});
