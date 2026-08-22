import { describe, expect, it } from "vitest";
import { chainLinks, scanImports, serverImportError } from "../src/guard.ts";

const ROOT = "/app";

describe("scanImports", () => {
	it("reads the clause and the line off a named import", () => {
		const code = "const x = 1;\nimport { a, b as c } from './m';\n";
		expect(scanImports(code)).toEqual([
			{ kind: "import", clause: "{ a, b as c }", source: "./m", line: 2 },
		]);
	});

	it("keeps default and namespace clauses as written", () => {
		const sites = scanImports("import d from 'd';\nimport * as ns from 'ns';\n");
		expect(sites.map((site) => site.clause)).toEqual(["d", "* as ns"]);
	});

	it("skips type-only imports — they never make it into a bundle", () => {
		expect(scanImports("import type { A } from './a';\nexport type { B } from './b';\n")).toEqual(
			[],
		);
	});

	it("keeps an inline `type` specifier, which does leave an import behind", () => {
		expect(scanImports("import { type A } from './a';")[0]?.clause).toBe("{ type A }");
	});

	it("reads bare, dynamic and re-export forms", () => {
		const sites = scanImports(
			"import './side';\nexport { a } from './re';\nawait import('./dyn');",
		);
		expect(sites.map((site) => [site.kind, site.source])).toEqual([
			["export", "./re"],
			["import", "./side"],
			["dynamic", "./dyn"],
		]);
	});

	it("does not let a preceding statement swallow the next import", () => {
		const sites = scanImports("export const x = 1\nimport { a } from './a'\n");
		expect(sites).toEqual([{ kind: "import", clause: "{ a }", source: "./a", line: 2 }]);
	});
});

describe("the chain in the error", () => {
	it("names the import each link wrote", async () => {
		const chain = await chainLinks(
			"/app/src/lib/shared.ts",
			["/app/src/routes/page.ts"],
			async () => ({ kind: "import", clause: "{ schema }", source: "@/lib/shared", line: 3 }),
		);
		const message = serverImportError({
			server: "/app/src/lib/db.server.ts",
			importer: "/app/src/lib/shared.ts",
			source: "@/lib/db.server",
			chain,
			root: ROOT,
		});
		expect(message).toContain("imported by src/lib/shared.ts");
		expect(message).toContain("← src/routes/page.ts:3 imports { schema }");
	});

	it("leaves a link bare when the import could not be found — virtual modules have no file", async () => {
		const chain = await chainLinks(
			"/app/src/routes/page.ts",
			["$implement/router"],
			async () => undefined,
		);
		const message = serverImportError({
			server: "/app/src/lib/db.server.ts",
			importer: "/app/src/routes/page.ts",
			source: "@/lib/db.server",
			chain,
			root: ROOT,
		});
		expect(message).toContain("← $implement/router");
	});
});
