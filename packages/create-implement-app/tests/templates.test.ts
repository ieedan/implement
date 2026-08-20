import { describe, expect, it } from "vitest";
import { getTemplate, templates } from "@/templates";
import { ADDONS, type Addon, TEMPLATES, type TemplateContext } from "@/templates/types";

function ctx(overrides: Partial<TemplateContext> = {}): TemplateContext {
	return { name: "my-app", addons: [], workspace: false, ...overrides };
}

function fileMap(id: (typeof TEMPLATES)[number], context: TemplateContext): Map<string, string> {
	return new Map(
		getTemplate(id)
			.files(context)
			.map((file) => [file.path, file.contents]),
	);
}

function pkg(files: Map<string, string>): {
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	scripts: Record<string, string>;
} {
	return JSON.parse(files.get("package.json") as string);
}

describe("templates", () => {
	it.each(TEMPLATES)("%s writes the files every app needs", (id) => {
		const files = fileMap(id, ctx());

		for (const path of [
			"package.json",
			"tsconfig.json",
			"vite.config.ts",
			"index.html",
			"app.css",
			".gitignore",
			"README.md",
		]) {
			expect(files.has(path), path).toBe(true);
		}
	});

	it.each(TEMPLATES)("%s names the package and titles the page", (id) => {
		const files = fileMap(id, ctx({ name: "cool-app" }));

		expect(pkg(files)).toMatchObject({ dependencies: { "@implementjs/core": expect.any(String) } });
		expect(JSON.parse(files.get("package.json") as string).name).toBe("cool-app");
		expect(files.get("index.html")).toContain("<title>cool-app</title>");
	});

	it.each(TEMPLATES)("%s asks for a version by default and workspace:* with --workspace", (id) => {
		expect(pkg(fileMap(id, ctx())).dependencies["@implementjs/core"]).toBe("latest");
		expect(pkg(fileMap(id, ctx({ workspace: true }))).dependencies["@implementjs/core"]).toBe(
			"workspace:*",
		);
	});

	it("the kit template lays out a routing tree", () => {
		const files = fileMap("kit", ctx());

		expect([...files.keys()]).toEqual(
			expect.arrayContaining([
				"src/routes/index.ts",
				"src/routes/layout.ts",
				"src/routes/about/index.ts",
				"src/routes/error.ts",
				"src/lib/counter.ts",
				"scripts/sync.ts",
			]),
		);
		expect(files.get("index.html")).toContain("/.implement/entry-client.ts");
		expect(files.get("vite.config.ts")).toContain("kit()");
		expect(files.get("tsconfig.json")).toContain("./.implement/tsconfig.json");
		// the root layout is the only place the global stylesheet is imported
		expect(files.get("src/routes/layout.ts")).toContain('import "../../app.css";');
		expect(pkg(files).devDependencies["@implementjs/kit"]).toBeDefined();
	});

	it("the csr template mounts an app into the page", () => {
		const files = fileMap("csr", ctx());

		expect(files.get("index.html")).toContain("/src/index.ts");
		expect(files.get("src/index.ts")).toContain(
			'App({ target: document.getElementById("root")! })',
		);
		expect(files.get("src/index.ts")).toContain("import.meta.hot");
		expect(files.get("src/counter.ts")).toBeDefined();
		expect(pkg(files).devDependencies["@implementjs/kit"]).toBeUndefined();
	});

	it.each(TEMPLATES)("%s only pulls in tailwind when the addon is selected", (id) => {
		const without = fileMap(id, ctx());
		expect(without.get("vite.config.ts")).not.toContain("@tailwindcss/vite");
		expect(without.get("app.css")).not.toContain('@import "tailwindcss"');
		expect(pkg(without).devDependencies.tailwindcss).toBeUndefined();

		const withTailwind = fileMap(id, ctx({ addons: ["tailwind"] }));
		expect(withTailwind.get("vite.config.ts")).toContain(
			'import tailwindcss from "@tailwindcss/vite"',
		);
		expect(withTailwind.get("vite.config.ts")).toContain("tailwindcss()");
		expect(withTailwind.get("app.css")).toContain('@import "tailwindcss"');
		expect(pkg(withTailwind).devDependencies["@tailwindcss/vite"]).toBeDefined();
	});

	it.each(TEMPLATES)("%s only pulls in primitives when the addon is selected", (id) => {
		const counter = (addons: Addon[]) =>
			fileMap(id, ctx({ addons })).get(id === "kit" ? "src/lib/counter.ts" : "src/counter.ts") ??
			"";

		expect(counter([])).not.toContain("@implementjs/primitives");
		expect(counter(["primitives"])).toContain("Collapsible");
		expect(
			pkg(fileMap(id, ctx({ addons: ["primitives"] }))).dependencies["@implementjs/primitives"],
		).toBeDefined();
	});

	it.each(TEMPLATES)("%s only pulls in icons when the addon is selected", (id) => {
		const counter = (addons: Addon[]) =>
			fileMap(id, ctx({ addons })).get(id === "kit" ? "src/lib/counter.ts" : "src/counter.ts") ??
			"";

		expect(counter([])).not.toContain("@implementjs/lucide");
		expect(counter(["icons"])).toContain("PlusIcon");
		expect(
			pkg(fileMap(id, ctx({ addons: ["icons"] }))).dependencies["@implementjs/lucide"],
		).toBeDefined();
	});

	it("every template and addon combination writes the same files twice", () => {
		for (const id of TEMPLATES) {
			const context = ctx({ addons: [...ADDONS] });
			expect(getTemplate(id).files(context)).toEqual(getTemplate(id).files(context));
		}
	});

	it("exposes a template for every id", () => {
		expect(new Set(Object.keys(templates))).toEqual(new Set(TEMPLATES));
	});
});
