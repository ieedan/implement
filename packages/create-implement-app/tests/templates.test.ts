import { describe, expect, it } from "vitest";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Template file map lookups return known scaffold paths. */
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
			".vscode/extensions.json",
			"README.md",
		]) {
			expect(files.has(path), path).toBe(true);
		}
	});

	it.each(TEMPLATES)("%s recommends the implement extension", (id) => {
		const recommended = JSON.parse(fileMap(id, ctx()).get(".vscode/extensions.json") as string) as {
			recommendations: string[];
		};

		expect(recommended.recommendations).toContain("implementjs.implement-vscode");
		// Nothing tailwind-specific without the addon.
		expect(recommended.recommendations).not.toContain("bradlc.vscode-tailwindcss");
	});

	it.each(TEMPLATES)("%s adds the tailwind extension with the addon", (id) => {
		const recommended = JSON.parse(
			fileMap(id, ctx({ addons: ["tailwind"] })).get(".vscode/extensions.json") as string,
		) as { recommendations: string[] };

		expect(recommended.recommendations).toEqual([
			"implementjs.implement-vscode",
			"bradlc.vscode-tailwindcss",
		]);
	});

	it.each(TEMPLATES)("%s names the package and titles the page", (id) => {
		const files = fileMap(id, ctx({ name: "cool-app" }));

		expect(pkg(files)).toMatchObject({ dependencies: { "@implementjs/core": expect.any(String) } });
		expect(JSON.parse(files.get("package.json") as string).name).toBe("cool-app");
		expect(files.get("src/index.html")).toContain("<title>cool-app</title>");
	});

	it.each(TEMPLATES)("%s asks for a version by default and workspace:* with --workspace", (id) => {
		// a range and not a tag: `latest` would resolve at install time, so the same CLI would
		// scaffold apps built against different releases
		expect(pkg(fileMap(id, ctx())).dependencies["@implementjs/core"]).toMatch(/^\^\d+\.\d+\.\d+$/);
		expect(pkg(fileMap(id, ctx({ workspace: true }))).dependencies["@implementjs/core"]).toBe(
			"workspace:*",
		);
	});

	it("the kit template lays out a routing tree", () => {
		const files = fileMap("kit", ctx());

		expect([...files.keys()]).toEqual(
			expect.arrayContaining([
				"src/routes/page.ts",
				"src/routes/layout.ts",
				"src/routes/about/page.ts",
				"src/routes/error.ts",
				"src/lib/counter.ts",
				"src/app.d.ts",
			]),
		);
		// the generated files are written by the `implement-kit` bin, not a script in the app
		expect([...files.keys()]).not.toContain("scripts/sync.ts");
		expect(files.get("package.json")).toContain('"sync": "implement-kit sync"');
		expect(files.get("package.json")).toContain('"prepare": "implement-kit sync');
		expect(files.get("src/index.html")).toContain("/.implement/entry-client.ts");
		expect(files.get("vite.config.ts")).toContain("kit()");
		expect(files.get("tsconfig.json")).toContain("./.implement/tsconfig.json");
		// the root layout is the only place the global stylesheet is imported
		expect(files.get("src/routes/layout.ts")).toContain('import "../app.css";');
		expect(pkg(files).devDependencies["@implementjs/kit"]).toBeDefined();
		// App.Locals is declared for the app to fill in, hooks.server.ts or not
		expect(files.get("src/app.d.ts")).toContain("namespace App");
	});

	it("the kit template wires up public environment variables", () => {
		const files = fileMap("kit", ctx({ name: "cool-app" }));

		expect(files.get("src/lib/env.public.ts")).toContain("defineEnv({");
		expect(files.get("src/lib/env.public.ts")).toContain("PUBLIC_APP_NAME");
		// .env so the app runs straight away, .env.example so a fresh clone knows the keys
		expect(files.get(".env")).toBe("PUBLIC_APP_NAME=cool-app\n");
		expect(files.get(".env.example")).toBe(files.get(".env"));
		expect(files.get(".gitignore")).toContain(".env");
		expect(files.get(".gitignore")).toContain("!.env.example");
		expect(files.get("src/routes/about/page.ts")).toContain('from "@/lib/env.public"');
		// the schemas are evaluated at build time and inlined, so zod never ships
		expect(pkg(files).devDependencies.zod).toBeDefined();
		expect(pkg(files).dependencies.zod).toBeUndefined();
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

	it.each(TEMPLATES)("%s only pulls in mode-watcher when the addon is selected", (id) => {
		const modePath = id === "kit" ? "src/lib/mode.ts" : "src/mode.ts";
		const counterPath = id === "kit" ? "src/lib/counter.ts" : "src/counter.ts";

		const without = fileMap(id, ctx());
		expect(without.has(modePath)).toBe(false);
		expect(without.get(counterPath)).not.toContain("ModeToggle");
		expect(pkg(without).dependencies["@implementjs/mode-watcher"]).toBeUndefined();

		const withMode = fileMap(id, ctx({ addons: ["modeWatcher"] }));
		expect(withMode.get(modePath)).toContain("createModeManager()");
		expect(withMode.get(modePath)).toContain("mode.toggleMode()");
		// the counter page renders the toggle, so a new app opens on a working switch
		expect(withMode.get(counterPath)).toContain("ModeToggle()");
		expect(pkg(withMode).dependencies["@implementjs/mode-watcher"]).toBeDefined();
	});

	it.each(TEMPLATES)("%s mounts ModeWatcher once, at the root", (id) => {
		const files = fileMap(id, ctx({ addons: ["modeWatcher"] }));
		// kit's root layout outlives every navigation; the csr entry is the only mount there is
		const root = files.get(id === "kit" ? "src/routes/layout.ts" : "src/index.ts") ?? "";

		expect(root).toContain('import { ModeWatcher } from "@implementjs/mode-watcher"');
		expect(root.match(/ModeWatcher\(\{ manager: mode \}\)/g)).toHaveLength(1);
	});

	it.each(TEMPLATES)("%s styles both modes once mode-watcher is selected", (id) => {
		// tailwind resolves `dark:` from the media query unless it is pointed at the class
		const tailwind = fileMap(id, ctx({ addons: ["tailwind", "modeWatcher"] }));
		expect(tailwind.get("src/app.css")).toContain("@custom-variant dark (&:where(.dark, .dark *))");
		expect(tailwind.get("src/app.css")).toContain("dark:bg-zinc-950");
		expect(tailwind.get("src/index.html")).toContain('content="light dark"');

		// without tailwind the same swap is a `.dark` block redefining the custom properties
		const plain = fileMap(id, ctx({ addons: ["modeWatcher"] }));
		expect(plain.get("src/app.css")).toContain(".dark {");
		expect(plain.get("src/app.css")).not.toContain("color-scheme: dark;");
	});

	it("stays dark only when mode-watcher is not selected", () => {
		const tailwind = fileMap("csr", ctx({ addons: ["tailwind"] }));
		expect(tailwind.get("src/app.css")).toContain("color-scheme: dark;");
		expect(tailwind.get("src/app.css")).not.toContain("dark:");
		expect(tailwind.get("src/index.html")).toContain('content="dark"');

		expect(fileMap("csr", ctx()).get("src/app.css")).toContain("color-scheme: dark;");
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
		expect(tailwind).toContain("border-zinc-800");
	});

	it.each(TEMPLATES)("%s only sets up the ui registry when the addon is selected", (id) => {
		const counterPath = id === "kit" ? "src/lib/counter.ts" : "src/counter.ts";

		const without = fileMap(id, ctx({ addons: ["tailwind", "primitives"] }));
		expect(without.has("jsrepo.config.ts")).toBe(false);
		expect(pkg(without).devDependencies.jsrepo).toBeUndefined();
		expect(pkg(without).dependencies["tailwind-variants"]).toBeUndefined();

		const withUi = fileMap(id, ctx({ addons: ["tailwind", "primitives", "ui"] }));
		expect(withUi.get("jsrepo.config.ts")).toContain('registries: ["@implementjs/ui"]');
		// the components are `ui` items, and the `cn` they share is a `lib`
		expect(withUi.get("jsrepo.config.ts")).toContain('ui: "src/lib/components/ui"');
		expect(withUi.get("jsrepo.config.ts")).toContain('lib: "src/lib"');
		expect(pkg(withUi).devDependencies.jsrepo).toBeDefined();
		expect(pkg(withUi).dependencies["tailwind-variants"]).toBeDefined();
		expect(pkg(withUi).scripts.ui).toBe("jsrepo add");
		// the counter opens on a styled Button rather than the bare element from core
		expect(withUi.get(counterPath)).toContain("components/ui/button");
		expect(withUi.get(counterPath)).toContain('variant: "outline", size: "icon"');
		expect(withUi.get(counterPath)).not.toContain("Button,");
	});

	it.each(TEMPLATES)("%s reads a linked registry off disk", (id) => {
		const files = fileMap(
			id,
			ctx({ addons: ["tailwind", "primitives", "ui"], linkRoot: "../implement" }),
		);
		const config = files.get("jsrepo.config.ts") ?? "";

		expect(config).toContain('registries: ["fs://../implement/apps/docs"]');
		expect(config).toContain('import { fs } from "jsrepo/providers"');
		// the fs provider is added to the built in ones, not swapped in for them
		expect(config).toContain("providers: [...DEFAULT_PROVIDERS, fs()]");
	});

	it("the ui addon swaps the palette for the tokens the components read", () => {
		const css = fileMap("csr", ctx({ addons: ["tailwind", "primitives", "ui"] })).get(
			"src/app.css",
		);

		// `:root` names the values, `@theme inline` is what makes `bg-primary` compile at all
		expect(css).toContain("--primary: #fff;");
		expect(css).toContain("--color-primary: var(--primary);");
		// components write `border` with no color on the assumption that the default is the token
		expect(css).toContain("@apply border-border;");
		expect(css).not.toContain("zinc");

		// with mode-watcher the same tokens get a light half and a `.dark` block
		const dual = fileMap(
			"csr",
			ctx({ addons: ["tailwind", "primitives", "ui", "modeWatcher"] }),
		).get("src/app.css");
		expect(dual).toContain(".dark {");
		expect(dual).not.toContain("color-scheme: dark;");
	});

	it.each(TEMPLATES)("%s allows the build scripts pnpm would otherwise refuse", (id) => {
		// pnpm 11 fails the install outright on an unapproved build script, and vite's esbuild has one
		const workspace = fileMap(id, ctx({ packageManager: "pnpm" })).get("pnpm-workspace.yaml");
		expect(workspace).toContain("allowBuilds:");
		expect(workspace).toContain("esbuild: true");

		// nothing else blocks build scripts, and an app inside the monorepo answers to the root file
		expect(fileMap(id, ctx({ packageManager: "npm" })).has("pnpm-workspace.yaml")).toBe(false);
		expect(
			fileMap(id, ctx({ packageManager: "pnpm", workspace: true })).has("pnpm-workspace.yaml"),
		).toBe(false);
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
