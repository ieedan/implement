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
			"src/index.html",
			"src/app.css",
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
		expect(files.get("src/index.html")).toContain("<title>cool-app</title>");
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
				"src/app.d.ts",
				"scripts/sync.ts",
			]),
		);
		expect(files.get("src/index.html")).toContain("/.implement/entry-client.ts");
		expect(files.get("vite.config.ts")).toContain("kit()");
		expect(files.get("tsconfig.json")).toContain("./.implement/tsconfig.json");
		// the root layout is the only place the global stylesheet is imported
		expect(files.get("src/routes/layout.ts")).toContain('import "../app.css";');
		expect(pkg(files).devDependencies["@implementjs/kit"]).toBeDefined();
		// App.Locals is declared for the app to fill in, hooks.server.ts or not
		expect(files.get("src/app.d.ts")).toContain("namespace App");
	});

	it("the csr template mounts an app into the page", () => {
		const files = fileMap("csr", ctx());

		// vite's root is src/, so the shell points at its sibling entry
		expect(files.get("vite.config.ts")).toContain('root: "src"');
		expect(files.get("src/index.html")).toContain("/index.ts");
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
		expect(without.get("src/app.css")).not.toContain('@import "tailwindcss"');
		expect(pkg(without).devDependencies.tailwindcss).toBeUndefined();

		const withTailwind = fileMap(id, ctx({ addons: ["tailwind"] }));
		expect(withTailwind.get("vite.config.ts")).toContain(
			'import tailwindcss from "@tailwindcss/vite"',
		);
		expect(withTailwind.get("vite.config.ts")).toContain("tailwindcss()");
		expect(withTailwind.get("src/app.css")).toContain('@import "tailwindcss"');
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

	it.each(TEMPLATES)("%s only pulls in formish when the addon is selected", (id) => {
		const formPath = id === "kit" ? "src/lib/sign-up-form.ts" : "src/sign-up-form.ts";
		const counterPath = id === "kit" ? "src/lib/counter.ts" : "src/counter.ts";

		const without = fileMap(id, ctx());
		expect(without.has(formPath)).toBe(false);
		expect(without.get(counterPath)).not.toContain("SignUpForm");
		expect(pkg(without).dependencies["@implementjs/formish"]).toBeUndefined();

		const withForms = fileMap(id, ctx({ addons: ["forms"] }));
		expect(withForms.get(formPath)).toContain('from "@implementjs/formish"');
		expect(withForms.get(formPath)).toContain("createForm({ schema: SignUpSchema })");
		// the counter page renders it, so a new app opens on a working form
		expect(withForms.get(counterPath)).toContain("SignUpForm()");
		expect(pkg(withForms).dependencies["@implementjs/formish"]).toBeDefined();
		expect(pkg(withForms).dependencies.valibot).toBeDefined();
	});

	it("the form's class names follow the tailwind addon", () => {
		const plain = fileMap("csr", ctx({ addons: ["forms"] })).get("src/sign-up-form.ts") ?? "";
		expect(plain).toContain('input: "input"');
		expect(fileMap("csr", ctx({ addons: ["tailwind"] })).get("src/app.css")).not.toContain(
			".input {",
		);
		expect(fileMap("csr", ctx({ addons: ["forms"] })).get("src/app.css")).toContain(".input {");

		const tailwind =
			fileMap("csr", ctx({ addons: ["tailwind", "forms"] })).get("src/sign-up-form.ts") ?? "";
		expect(tailwind).toContain("rounded-md border border-zinc-800");
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
