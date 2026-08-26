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

/** A full stack app on `@implementjs/kit`: file based routing, SSR in dev, prerendered on build. */
export const kit: Template = {
	id: "kit",
	label: "implement-kit",
	hint: "File based routing, SSR & prerendering",
	files: (ctx) => [
		{ path: "package.json", contents: pkg(ctx) },
		...(needsPnpmWorkspace(ctx)
			? [{ path: "pnpm-workspace.yaml", contents: pnpmWorkspace() }]
			: []),
		{
			path: "tsconfig.json",
			contents: tsconfig({
				extend: "./.implement/tsconfig.json",
				include: ["src/**/*.ts", "*.config.ts", ".implement/**/*.ts", ".implement/types/**/*.d.ts"],
				types: ["node", "vite/client"],
			}),
		},
		{ path: "vite.config.ts", contents: viteConfig(ctx) },
		...(hasAddon(ctx, "ui") ? [{ path: "jsrepo.config.ts", contents: jsrepoConfig(ctx) }] : []),
		{
			path: "src/index.html",
			contents: indexHtml(ctx, { title: ctx.name, entry: "/.implement/entry-client.ts" }),
		},
		{ path: "src/app.css", contents: appCss(ctx) },
		{ path: "src/app.d.ts", contents: appTypes() },
		{ path: "src/routes/layout.ts", contents: layout(ctx) },
		{ path: "src/routes/page.ts", contents: page() },
		{ path: "src/routes/about/page.ts", contents: aboutPage(ctx) },
		{ path: "src/routes/error.ts", contents: errorPage(ctx) },
		{ path: "src/lib/counter.ts", contents: counter(ctx) },
		{ path: "src/lib/env.public.ts", contents: envPublic() },
		{ path: ".env", contents: envFile(ctx) },
		{ path: ".env.example", contents: envFile(ctx) },
		...(hasAddon(ctx, "modeWatcher")
			? [{ path: "src/lib/mode.ts", contents: modeModule(ctx) }]
			: []),
		...(hasAddon(ctx, "forms")
			? [{ path: "src/lib/sign-up-form.ts", contents: signUpFormComponent(ctx) }]
			: []),
		{ path: "static/favicon.svg", contents: favicon() },
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
	// no `@implementjs/router` here: the generated `$implement/router` module imports it,
	// but kit aliases the name at its own copy so the app never has to name a version
	const deps: Dependency[] = ["@implementjs/core"];
	if (hasAddon(ctx, "primitives")) deps.push("@implementjs/primitives");
	if (hasAddon(ctx, "icons")) deps.push("@implementjs/lucide");
	if (hasAddon(ctx, "forms")) deps.push("@implementjs/formish", "valibot");
	if (hasAddon(ctx, "modeWatcher")) deps.push("@implementjs/mode-watcher");
	// what the styled components are built out of: `tv()` for the variant tables, and the
	// tailwind-merge behind `cn()` that makes a class passed in override the one baked in
	if (hasAddon(ctx, "ui")) deps.push("tailwind-merge", "tailwind-variants");

	// valibot is a devDependency on purpose: kit evaluates the env files at build time and
	// inlines the results, so the schemas never reach a bundle
	const devDeps: Dependency[] = ["@implementjs/kit", "@types/node", "typescript", "vite"];
	// the forms addon already depends on valibot at runtime, so it is not added twice
	if (!hasAddon(ctx, "forms")) devDeps.push("valibot");
	if (hasAddon(ctx, "tailwind")) devDeps.push("@tailwindcss/vite", "tailwindcss");
	if (hasAddon(ctx, "ui")) devDeps.push("jsrepo");

	return packageJson({
		name: ctx.name,
		scripts: {
			dev: "vite",
			build: "vite build",
			preview: "vite preview",
			sync: "implement-kit sync",
			// `.implement/` is generated, so a fresh clone has none until something writes it.
			// prepare runs on install for exactly that, and never fails the install if it cannot
			prepare: "implement-kit sync || echo ''",
			// tsc needs those same generated files, and vite may not have run yet
			check: "implement-kit sync && tsc --noEmit",
			...(hasAddon(ctx, "ui") ? { [UI_SCRIPT]: "jsrepo add" } : {}),
		},
		dependencies: dependencies(ctx, deps),
		devDependencies: dependencies(ctx, devDeps),
	});
}

function viteConfig(ctx: TemplateContext): string {
	const { imports, plugins } = vitePlugins(ctx, ["kit()"]);

	return `${[
		`import { kit } from "@implementjs/kit";`,
		...imports,
		`import { defineConfig } from "vite";`,
		``,
		`export default defineConfig({`,
		`\tplugins: [${plugins.join(", ")}],`,
		`});`,
	].join("\n")}\n`;
}

/**
 * The app's server types. `App.Locals` is what `src/hooks.server.ts` hands the
 * app's loads and endpoints, so this is where it gets typed.
 */
function appTypes(): string {
	return (
		dedent`
		declare global {
			namespace App {
				// what src/hooks.server.ts puts on event.locals, and routes read
				interface Locals {}
			}
		}

		export {};
	` + "\n"
	);
}

function layout(ctx: TemplateContext): string {
	const c = styles(ctx);
	const modeWatcher = hasAddon(ctx, "modeWatcher");

	return `${[
		`import { router } from "$implement/router";`,
		`import { Div, Main, Nav } from "@implementjs/core";`,
		...(modeWatcher ? [`import { ModeWatcher } from "@implementjs/mode-watcher";`] : []),
		...(modeWatcher ? [`import { mode } from "@/lib/mode";`] : []),
		`import type { LayoutProps } from "./$types";`,
		`import "../app.css";`,
		``,
		`export default function Layout({ children }: LayoutProps) {`,
		`\treturn Div(`,
		...(modeWatcher
			? [
					`\t\t// the root layout stays mounted for the life of the app, so the blocking script`,
					`\t\t// this renders into the head runs before the first paint of every page`,
					`\t\tModeWatcher({ manager: mode }),`,
				]
			: []),
		`\t\tNav(`,
		...object([`class: "${c.nav}"`], 3),
		...call("router.Link", [`class: "${c.navLink}"`, `to: "/"`], [`"Home"`], 3),
		...call("router.Link", [`class: "${c.navLink}"`, `to: "/about"`], [`"About"`], 3),
		`\t\t),`,
		...call("Main", [`class: "${c.main}"`], ["children"], 2),
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

function page(): string {
	return (
		dedent`
		import { Counter } from "@/lib/counter";

		export default function Page() {
			return Counter();
		}
	` + "\n"
	);
}

function aboutPage(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { A, Div, H1, P } from "@implementjs/core";`,
		`import { env } from "@/lib/env.public";`,
		``,
		`export default function Page() {`,
		`\treturn Div(`,
		`\t\t{ class: "${c.page}" },`,
		`\t\tH1({ class: "${c.title}" }, env.PUBLIC_APP_NAME),`,
		`\t\tP(`,
		`\t\t\t{ class: "${c.subtitle}" },`,
		`\t\t\t"This page is ",`,
		`\t\t\t"src/routes/about/page.ts",`,
		`\t\t\t" — every directory under src/routes with a page.ts is a route.",`,
		`\t\t),`,
		...call("A", [`class: "${c.link}"`, `href: "${DOCS_URL}"`], [`"Read the docs"`], 2),
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

function errorPage(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { Div, H1, P } from "@implementjs/core";`,
		`import type { ErrorProps } from "./$types";`,
		``,
		`/** Renders when no route matches, or when a page or layout throws while rendering. */`,
		`export default function ErrorPage({ error }: ErrorProps) {`,
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
		{ label: "Routing", href: `${DOCS_URL}/tree/main/packages/kit` },
	];
	if (hasAddon(ctx, "primitives")) {
		links.push({ label: "Primitives", href: `${DOCS_URL}/tree/main/packages/primitives` });
	}
	if (hasAddon(ctx, "forms")) {
		links.push({ label: "Forms", href: `${DOCS_URL}/tree/main/packages/formish` });
	}
	if (hasAddon(ctx, "modeWatcher")) {
		links.push({ label: "Dark mode", href: `${DOCS_URL}/tree/main/packages/mode-watcher` });
	}
	if (hasAddon(ctx, "ui")) {
		links.push({ label: "Components", href: `${DOCS_URL}/tree/main/apps/docs/src/content/ui` });
	}

	return counterComponent(ctx, {
		editPath: "src/lib/counter.ts",
		links,
		formImport: "@/lib/sign-up-form",
		modeImport: "@/lib/mode",
		uiImport: `@/${UI_PATH.slice("src/".length)}/button`,
	});
}

function envPublic(): string {
	return (
		dedent`
		import { defineEnv } from "@implementjs/kit";
		import * as v from "valibot";

		// Every key here must start with PUBLIC_ — these values are inlined into the browser
		// bundle. Secrets belong in a sibling \`env.server.ts\`, which never ships.
		export const env = defineEnv({
			PUBLIC_APP_NAME: v.string(),
		});
	` + "\n"
	);
}

/** Written twice: \`.env\` so the app runs immediately, \`.env.example\` so a fresh clone knows what to set. */
function envFile(ctx: TemplateContext): string {
	return `PUBLIC_APP_NAME=${ctx.name}\n`;
}

function favicon(): string {
	return (
		dedent`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
			<rect width="32" height="32" rx="6" fill="#09090b" />
			<path d="M12 8h3v16h-3z" fill="#f4f4f5" />
			<path d="M17 8h3v16h-3z" fill="#a1a1aa" />
		</svg>
	` + "\n"
	);
}

function readme(ctx: TemplateContext): string {
	const addons = ctx.addons.length > 0 ? ctx.addons.join(", ") : "none";

	return (
		dedent`
		# ${ctx.name}

		An [implement](${DOCS_URL}) app on [\`@implementjs/kit\`](${DOCS_URL}/tree/main/packages/kit) — file
		based routing, server rendering in dev, and a prerendered static site on build.

		Addons: ${addons}

		## Scripts

		| Script    | What it does                                  |
		| --------- | --------------------------------------------- |
		| \`dev\`     | Start the dev server (server rendered, HMR)   |
		| \`build\`   | Prerender the site into \`dist/\`               |
		| \`preview\` | Serve the build locally                       |
		| \`sync\`    | Regenerate \`.implement/\` without running vite |
		| \`check\`   | Sync, then typecheck the app                  |

		## Structure

		\`\`\`
		${ctx.name}/
		├ src/
		│  ├ lib/            @/lib — components, helpers, state
		│  │  └ env.public.ts  typed environment variables, safe to ship
		│  ├ routes/         the routing tree
		│  │  ├ about/
		│  │  │  └ page.ts   → /about
		│  │  ├ error.ts     the 404 / render error page
		│  │  ├ layout.ts    wraps every page
		│  │  └ page.ts      → /
		│  ├ app.css         global styles, imported from the root layout
		│  └ index.html      the shell, pointed at the generated client entry
		└ static/            served from the site root
		\`\`\`

		\`.env\` holds the values \`src/lib/env.public.ts\` validates; it is gitignored, and
		\`.env.example\` is the committed list of keys. Keys there must start with \`PUBLIC_\` — add a
		\`src/lib/env.server.ts\` for anything that must not reach the browser.

		\`page.ts\` is a page, \`layout.ts\` wraps everything below it, and \`[param]\` / \`[...rest]\`
		directories bind params. Kit generates \`.implement/\` (entries, the tsconfig this app extends, and
		a \`./$types\` for every route) — it is gitignored and regenerates itself, so nothing in there
		needs editing.
	` + "\n"
	);
}
