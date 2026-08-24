import dedent from "dedent";
import {
	appCss,
	counterComponent,
	DOCS_URL,
	gitignore,
	indexHtml,
	jsrepoConfig,
	modeModule,
	needsPnpmWorkspace,
	packageJson,
	pnpmWorkspace,
	signUpFormComponent,
	tsconfig,
	UI_PATH,
	UI_SCRIPT,
	vitePlugins,
	vscodeExtensions,
	vscodeSettings,
} from "@/templates/shared";
import { hasAddon, type Template, type TemplateContext } from "@/templates/types";
import { dependencies, type Dependency } from "@/templates/versions";

/** A client rendered single page app: Vite serves `index.html`, `src/index.ts` mounts the app. */
export const csr: Template = {
	id: "csr",
	label: "CSR with vite",
	hint: "A client rendered app on plain Vite",
	files: (ctx) => [
		{ path: "package.json", contents: pkg(ctx) },
		...(needsPnpmWorkspace(ctx)
			? [{ path: "pnpm-workspace.yaml", contents: pnpmWorkspace() }]
			: []),
		{
			path: "tsconfig.json",
			contents: tsconfig({ include: ["src/**/*.ts", "*.config.ts"], types: ["vite/client"] }),
		},
		{ path: "vite.config.ts", contents: viteConfig(ctx) },
		...(hasAddon(ctx, "ui") ? [{ path: "jsrepo.config.ts", contents: jsrepoConfig(ctx) }] : []),
		{ path: "src/index.html", contents: indexHtml(ctx, { title: ctx.name, entry: "/index.ts" }) },
		{ path: "src/app.css", contents: appCss(ctx) },
		{ path: "src/index.ts", contents: entry(ctx) },
		{ path: "src/counter.ts", contents: counter(ctx) },
		...(hasAddon(ctx, "modeWatcher") ? [{ path: "src/mode.ts", contents: modeModule(ctx) }] : []),
		...(hasAddon(ctx, "forms")
			? [{ path: "src/sign-up-form.ts", contents: signUpFormComponent(ctx) }]
			: []),
		{ path: ".gitignore", contents: gitignore() },
		{ path: ".vscode/extensions.json", contents: vscodeExtensions(ctx) },
		// the recommended tailwind extension needs telling where an implement app keeps its classes
		...(hasAddon(ctx, "tailwind")
			? [{ path: ".vscode/settings.json", contents: vscodeSettings(ctx) }]
			: []),
		{ path: "README.md", contents: readme(ctx) },
	],
};

function pkg(ctx: TemplateContext): string {
	const deps: Dependency[] = ["@implementjs/core"];
	if (hasAddon(ctx, "primitives")) deps.push("@implementjs/primitives");
	if (hasAddon(ctx, "icons")) deps.push("@implementjs/lucide");
	if (hasAddon(ctx, "forms")) deps.push("@implementjs/formish", "valibot");
	if (hasAddon(ctx, "modeWatcher")) deps.push("@implementjs/mode-watcher");
	// what the styled components are built out of: `tv()` for the variant tables, and the
	// tailwind-merge behind `cn()` that makes a class passed in override the one baked in
	if (hasAddon(ctx, "ui")) deps.push("tailwind-merge", "tailwind-variants");

	const devDeps: Dependency[] = ["typescript", "vite"];
	if (hasAddon(ctx, "tailwind")) devDeps.push("@tailwindcss/vite", "tailwindcss");
	if (hasAddon(ctx, "ui")) devDeps.push("jsrepo");

	return packageJson({
		name: ctx.name,
		scripts: {
			dev: "vite",
			build: "vite build",
			preview: "vite preview",
			check: "tsc --noEmit",
			...(hasAddon(ctx, "ui") ? { [UI_SCRIPT]: "jsrepo add" } : {}),
		},
		dependencies: dependencies(ctx, deps),
		devDependencies: dependencies(ctx, devDeps),
	});
}

function viteConfig(ctx: TemplateContext): string {
	const { imports, plugins } = vitePlugins(ctx, []);

	return `${[
		...imports,
		`import { defineConfig } from "vite";`,
		``,
		`export default defineConfig({`,
		`\t// the app — index.html included — lives in src/, the build still lands in dist/`,
		`\troot: "src",`,
		`\tbuild: { outDir: "../dist", emptyOutDir: true },`,
		`\tplugins: [${plugins.join(", ")}],`,
		`});`,
	].join("\n")}\n`;
}

function entry(ctx: TemplateContext): string {
	if (hasAddon(ctx, "modeWatcher")) return modeEntry();

	return (
		dedent`
		import { App } from "@implementjs/core";
		import { Counter } from "./counter";
		import "./app.css";

		const app = App({ target: document.getElementById("root")! });

		// HMR: vite needs the accept call to be statically present in the entry, and the app tears down
		// every root it rendered before the entry re-runs, so edits patch the page instead of reloading it.
		if (import.meta.hot) {
			import.meta.hot.accept();
			import.meta.hot.dispose(app.unmount);
		}

		app.render(Counter());
	` + "\n"
	);
}

/**
 * The entry the `modeWatcher` addon writes: `ModeWatcher` renders alongside the app so its blocking
 * script lands in the head, and the manager it is handed starts applying the mode on mount.
 */
function modeEntry(): string {
	return (
		dedent`
		import { App } from "@implementjs/core";
		import { ModeWatcher } from "@implementjs/mode-watcher";
		import { Counter } from "./counter";
		import { mode } from "./mode";
		import "./app.css";

		const app = App({ target: document.getElementById("root")! });

		// HMR: vite needs the accept call to be statically present in the entry, and the app tears down
		// every root it rendered before the entry re-runs, so edits patch the page instead of reloading it.
		if (import.meta.hot) {
			import.meta.hot.accept();
			import.meta.hot.dispose(app.unmount);
		}

		app.render(ModeWatcher({ manager: mode }), Counter());
	` + "\n"
	);
}

function counter(ctx: TemplateContext): string {
	const links = [
		{ label: "Documentation", href: DOCS_URL },
		{ label: "Vite", href: "https://vite.dev" },
	];
	if (hasAddon(ctx, "primitives")) {
		links.splice(1, 0, {
			label: "Primitives",
			href: `${DOCS_URL}/tree/main/packages/primitives`,
		});
	}
	if (hasAddon(ctx, "forms")) {
		links.splice(1, 0, { label: "Forms", href: `${DOCS_URL}/tree/main/packages/formish` });
	}
	if (hasAddon(ctx, "modeWatcher")) {
		links.splice(1, 0, {
			label: "Dark mode",
			href: `${DOCS_URL}/tree/main/packages/mode-watcher`,
		});
	}
	if (hasAddon(ctx, "ui")) {
		links.splice(1, 0, {
			label: "Components",
			href: `${DOCS_URL}/tree/main/apps/docs/src/content/ui`,
		});
	}

	return counterComponent(ctx, {
		editPath: "src/counter.ts",
		links,
		formImport: "./sign-up-form",
		modeImport: "./mode",
		uiImport: `./${UI_PATH.slice("src/".length)}/button`,
	});
}

function readme(ctx: TemplateContext): string {
	const addons = ctx.addons.length > 0 ? ctx.addons.join(", ") : "none";

	return (
		dedent`
		# ${ctx.name}

		A client rendered [implement](${DOCS_URL}) app on [Vite](https://vite.dev).

		Addons: ${addons}

		## Scripts

		| Script    | What it does                          |
		| --------- | ------------------------------------- |
		| \`dev\`     | Start the dev server with HMR         |
		| \`build\`   | Build the static site into \`dist/\`    |
		| \`preview\` | Serve the build locally               |
		| \`check\`   | Typecheck the app                     |

		## Structure

		\`\`\`
		${ctx.name}/
		└ src/             the vite root
		   ├ app.css       global styles
		   ├ counter.ts    the component the page renders
		   ├ index.html    the page vite serves
		   └ index.ts      mounts the app into #root
		\`\`\`

		\`App({ target })\` creates the root and \`app.render(...)\` mounts children into it. Components are
		plain functions that run once — [signals](${DOCS_URL}) update the DOM, there is no re-render.
	` + "\n"
	);
}
