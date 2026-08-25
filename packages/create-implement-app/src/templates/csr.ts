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
	styles,
	tsconfig,
	UI_PATH,
	UI_SCRIPT,
	vitePlugins,
	vscodeExtensions,
	vscodeSettings,
} from "@/templates/shared";
import { hasAddon, type Template, type TemplateContext } from "@/templates/types";
import { dependencies, type Dependency } from "@/templates/versions";
import { call, object } from "@/utils/format";

/**
 * A client rendered single page app: Vite serves `index.html`, `src/index.ts` mounts the router,
 * and `@implementjs/router` matches the path against the table in `src/router.ts`.
 */
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
		{ path: "src/router.ts", contents: routerModule() },
		{ path: "src/layout.ts", contents: layout(ctx) },
		{ path: "src/counter.ts", contents: counter(ctx) },
		{ path: "src/about.ts", contents: aboutPage(ctx) },
		{ path: "src/not-found.ts", contents: notFoundPage(ctx) },
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
	const deps: Dependency[] = ["@implementjs/core", "@implementjs/router"];
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
		import { router } from "./router";
		import "./app.css";

		const app = App({ target: document.getElementById("root")! });

		// HMR: vite needs the accept call to be statically present in the entry, and the app tears down
		// every root it rendered before the entry re-runs, so edits patch the page instead of reloading it.
		if (import.meta.hot) {
			import.meta.hot.accept();
			import.meta.hot.dispose(app.unmount);
		}

		// the router is itself a mountable: it renders whichever route matches the current path
		app.render(router);
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
		import { mode } from "./mode";
		import { router } from "./router";
		import "./app.css";

		const app = App({ target: document.getElementById("root")! });

		// HMR: vite needs the accept call to be statically present in the entry, and the app tears down
		// every root it rendered before the entry re-runs, so edits patch the page instead of reloading it.
		if (import.meta.hot) {
			import.meta.hot.accept();
			import.meta.hot.dispose(app.unmount);
		}

		// the router is itself a mountable: it renders whichever route matches the current path
		app.render(ModeWatcher({ manager: mode }), router);
	` + "\n"
	);
}

/**
 * The route table. Keys are path segments, `"/"` renders a level, and `layout` wraps everything
 * beneath it. `:param` segments, nested tables and catch-alls are all keys in the same object.
 */
function routerModule(): string {
	return (
		dedent`
		import { Router } from "@implementjs/router";

		import { About } from "./about";
		import { Counter } from "./counter";
		import { Layout } from "./layout";
		import { NotFound } from "./not-found";

		export const router = Router(
			{
				layout: (child) => Layout(child),
				"/": () => Counter(),
				"/about": () => About(),
			},
			{ fallback: (error) => NotFound(error) },
		);
	` + "\n"
	);
}

/**
 * The shell every route renders inside. It imports `router` from the module that imports it back,
 * which is a cycle in both directions and wants care in both: ESM resolves it only because `router`
 * is touched inside the function body rather than at the top level, where the binding is still
 * uninitialized while `router.ts` evaluates — and TypeScript resolves it only because the return
 * type is written out, since inferring it would mean inferring `router` from a table that renders
 * this. Every view that links carries the same annotation for the same reason.
 */
function layout(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { Div, Main, Nav, type Mountable } from "@implementjs/core";`,
		`import { router } from "./router";`,
		``,
		`// the return type is annotated on purpose: this reads \`router\`, which is inferred from the`,
		`// table that renders this, and TypeScript will not chase that circle on its own`,
		`export function Layout(children: Mountable): Mountable {`,
		`\treturn Div(`,
		`\t\tNav(`,
		...object([`class: "${c.nav}"`], 3),
		`\t\t\t// a Link follows the router instead of reloading the document, and marks itself`,
		`\t\t\t// aria-current="page" while its path is the current one`,
		...call("router.Link", [`class: "${c.navLink}"`, `to: "/"`], [`"Home"`], 3),
		...call("router.Link", [`class: "${c.navLink}"`, `to: "/about"`], [`"About"`], 3),
		`\t\t),`,
		...call("Main", [`class: "${c.main}"`], ["children"], 2),
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

function aboutPage(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { A, Div, H1, P, type Mountable } from "@implementjs/core";`,
		``,
		`export function About(): Mountable {`,
		`\treturn Div(`,
		`\t\t{ class: "${c.page}" },`,
		`\t\tH1({ class: "${c.title}" }, "About"),`,
		`\t\tP(`,
		`\t\t\t{ class: "${c.subtitle}" },`,
		`\t\t\t"This page is ",`,
		`\t\t\t"src/about.ts",`,
		`\t\t\t" — add a route by adding a key to the table in src/router.ts.",`,
		`\t\t),`,
		...call("A", [`class: "${c.link}"`, `href: "${DOCS_URL}"`], [`"Read the docs"`], 2),
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

function notFoundPage(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { Div, H1, P, type Mountable } from "@implementjs/core";`,
		`import type { RouterError } from "@implementjs/router";`,
		``,
		`/** Renders when no route matches the path, or when a route throws while rendering. */`,
		`export function NotFound(error: RouterError): Mountable {`,
		`\treturn Div(`,
		`\t\t{ class: "${c.page}" },`,
		`\t\tH1({ class: "${c.title}" }, \`\${error.code}\`),`,
		`\t\tP({ class: "${c.subtitle}" }, error.message),`,
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

function counter(ctx: TemplateContext): string {
	const links = [
		{ label: "Documentation", href: DOCS_URL },
		{ label: "Routing", href: `${DOCS_URL}/tree/main/packages/router` },
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

		| Script    | What it does                       |
		| --------- | ---------------------------------- |
		| \`dev\`     | Start the dev server with HMR      |
		| \`build\`   | Build the static site into \`dist/\` |
		| \`preview\` | Serve the build locally            |
		| \`check\`   | Typecheck the app                  |

		## Structure

		\`\`\`
		${ctx.name}/
		└ src/             the vite root
		   ├ app.css       global styles
		   ├ about.ts      the /about route
		   ├ counter.ts    the component / renders
		   ├ index.html    the page vite serves
		   ├ index.ts      mounts the router into #root
		   ├ layout.ts     the nav every route renders inside
		   ├ not-found.ts  what renders when no route matches
		   └ router.ts     the route table
		\`\`\`

		\`App({ target })\` creates the root and \`app.render(...)\` mounts children into it. Components are
		plain functions that run once — [signals](${DOCS_URL}) update the DOM, there is no re-render.

		## Routing

		\`src/router.ts\` is the whole route table: keys are path segments, \`"/"\` renders a level, and
		\`layout\` wraps everything beneath it. Add a route by adding a key. \`:param\` segments arrive as
		signals, so navigating from \`/users/1\` to \`/users/2\` patches the param instead of remounting the
		page.

		The router uses history-mode URLs, which \`dev\` and \`preview\` already serve. A static host needs
		telling the same thing: rewrite unknown paths to \`index.html\`, or \`/about\` is a 404 on reload.
	` + "\n"
	);
}
