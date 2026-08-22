import { describe, expect, it } from "vitest";
import { adders, applyAdders, parseAdders } from "@/adders";
import { ADDERS, type AdderContext } from "@/adders/types";
import { unwrap, unwrapErr } from "./utils";

function ctx(overrides: Partial<AdderContext> = {}): AdderContext {
	return { workspace: false, packageManager: "pnpm", ...overrides };
}

function packageJson(overrides: Record<string, unknown> = {}): string {
	return `${JSON.stringify(
		{
			name: "my-app",
			private: true,
			version: "0.0.0",
			type: "module",
			scripts: { dev: "vite" },
			dependencies: { "@implementjs/core": "^0.0.3" },
			devDependencies: { vite: "^7.3.0" },
			...overrides,
		},
		null,
		"\t",
	)}\n`;
}

function parse(contents: string): {
	version: string;
	description?: string;
	scripts: Record<string, string>;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
} {
	return JSON.parse(contents);
}

describe("parseAdders", () => {
	it("narrows the names it knows", () => {
		expect(unwrap(parseAdders(["oxlint"]))).toEqual(["oxlint"]);
	});

	it("reports a name it doesn't know", () => {
		expect(unwrapErr(parseAdders(["prettier"])).toString()).toContain("is not a valid adder");
	});
});

describe("applyAdders", () => {
	it("writes the config the adder owns", () => {
		const changes = unwrap(applyAdders(["oxlint"], ctx(), packageJson()));

		expect(changes.files.map((file) => file.path)).toEqual(["oxlint.config.ts", "oxfmt.config.ts"]);
		expect(changes.files[0]?.contents).toContain(`jsPlugins: ["@implementjs/eslint"]`);
	});

	it("adds the scripts and dependencies to the package.json", () => {
		const changes = unwrap(applyAdders(["oxlint"], ctx(), packageJson()));

		const pkg = parse(changes.packageJson);
		expect(pkg.scripts).toEqual({
			dev: "vite",
			lint: "oxlint",
			"lint:fix": "oxlint --fix",
			format: "oxfmt",
			"format:check": "oxfmt --check",
		});
		expect(Object.keys(pkg.devDependencies)).toEqual([
			"@implementjs/eslint",
			"oxfmt",
			"oxlint",
			"vite",
		]);
		expect(changes.dependencies).toEqual(["@implementjs/eslint", "oxfmt", "oxlint"]);
	});

	it("leaves everything else in the package.json alone", () => {
		const changes = unwrap(
			applyAdders(["oxlint"], ctx(), packageJson({ description: "mine", version: "1.2.3" })),
		);

		const pkg = parse(changes.packageJson);
		expect(pkg.description).toBe("mine");
		expect(pkg.version).toBe("1.2.3");
		expect(changes.packageJson.endsWith("\n")).toBe(true);
	});

	it("keeps the indentation the file already used", () => {
		const twoSpaces = `${JSON.stringify({ name: "my-app", scripts: {} }, null, "  ")}\n`;

		const changes = unwrap(applyAdders(["oxlint"], ctx(), twoSpaces));

		expect(changes.packageJson).toContain('\n  "scripts"');
		expect(changes.packageJson).not.toContain("\t");
	});

	it("applies twice without changing anything the second time", () => {
		const once = unwrap(applyAdders(["oxlint"], ctx(), packageJson()));
		const twice = unwrap(applyAdders(["oxlint"], ctx(), once.packageJson));

		expect(twice.packageJson).toBe(once.packageJson);
		expect(twice.scripts).toEqual([]);
		expect(twice.dependencies).toEqual([]);
	});

	it("keeps a script the app already had under the same name", () => {
		const contents = packageJson({ scripts: { dev: "vite", lint: "eslint ." } });

		const changes = unwrap(applyAdders(["oxlint"], ctx(), contents));

		expect(parse(changes.packageJson).scripts.lint).toBe("eslint .");
		expect(changes.skippedScripts).toEqual(["lint"]);
		expect(changes.scripts).not.toContain("lint");
	});

	it("replaces a script the app already had with --overwrite", () => {
		const contents = packageJson({ scripts: { dev: "vite", lint: "eslint ." } });

		const changes = unwrap(applyAdders(["oxlint"], ctx(), contents, { overwrite: true }));

		expect(parse(changes.packageJson).scripts.lint).toBe("oxlint");
		expect(changes.skippedScripts).toEqual([]);
	});

	it("doesn't touch a dependency the app already has, at whatever version", () => {
		const contents = packageJson({ devDependencies: { oxlint: "^1.0.0", vite: "^7.3.0" } });

		const changes = unwrap(applyAdders(["oxlint"], ctx(), contents));

		expect(parse(changes.packageJson).devDependencies.oxlint).toBe("^1.0.0");
		expect(changes.skippedDependencies).toEqual(["oxlint"]);
	});

	it("depends on the implement packages with workspace:* when asked", () => {
		const changes = unwrap(applyAdders(["oxlint"], ctx({ workspace: true }), packageJson()));

		expect(parse(changes.packageJson).devDependencies["@implementjs/eslint"]).toBe("workspace:*");
	});

	it("links the implement packages it needs to a local clone", () => {
		const link = { "@implementjs/eslint": "link:../implement/packages/eslint" };

		const changes = unwrap(applyAdders(["oxlint"], ctx({ link }), packageJson()));

		expect(parse(changes.packageJson).devDependencies["@implementjs/eslint"]).toBe(
			"link:../implement/packages/eslint",
		);
	});

	it("errors when the linked repository is missing a package an adder needs", () => {
		const link = { "@implementjs/core": "link:../implement/packages/core" };

		const changes = applyAdders(["oxlint"], ctx({ link }), packageJson());

		expect(unwrapErr(changes).toString()).toContain("has no @implementjs/eslint");
	});

	it("errors on a package.json it can't read", () => {
		expect(unwrapErr(applyAdders(["oxlint"], ctx(), "{ nope")).toString()).toContain(
			"could not be read",
		);
	});

	it("changes nothing when no adders were named", () => {
		const contents = packageJson();

		const changes = unwrap(applyAdders([], ctx(), contents));

		expect(changes.packageJson).toBe(contents);
		expect(changes.files).toEqual([]);
	});
});

describe("the adder registry", () => {
	it.each(ADDERS)("%s declares what it needs to be applied", (id) => {
		const adder = adders[id];

		expect(adder.id).toBe(id);
		expect(adder.label.length).toBeGreaterThan(0);
		expect(adder.hint.length).toBeGreaterThan(0);
		// an adder with no files, no scripts, and no dependencies would be a no-op
		const changes =
			(adder.files?.(ctx()).length ?? 0) +
			Object.keys(adder.scripts ?? {}).length +
			(adder.dependencies?.length ?? 0) +
			(adder.devDependencies?.length ?? 0);
		expect(changes).toBeGreaterThan(0);
	});

	it.each(ADDERS)("%s only runs a script it wrote itself", (id) => {
		const adder = adders[id];
		if (adder.postInstallScript === undefined) return;

		expect(Object.keys(adder.scripts ?? {})).toContain(adder.postInstallScript);
	});
});
