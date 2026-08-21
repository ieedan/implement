import dedent from "dedent";
import {
	appCss,
	counterComponent,
	DOCS_URL,
	gitignore,
	indexHtml,
	packageJson,
	styles,
	tsconfig,
	vitePlugins,
} from "@/templates/shared";
import { hasAddon, type Template, type TemplateContext } from "@/templates/types";
import { dependencies, type Dependency } from "@/templates/versions";

/** A full stack app on `@implementjs/kit`: file based routing, SSR in dev, prerendered on build. */
export const kit: Template = {
	id: "kit",
	label: "implement-kit",
	hint: "File based routing, SSR & prerendering",
	files: (ctx) => [
		{ path: "package.json", contents: pkg(ctx) },
		{
			path: "tsconfig.json",
			contents: tsconfig({
				extend: "./.implement/tsconfig.json",
				include: [
					"src/**/*.ts",
					"scripts/**/*.ts",
					"*.config.ts",
					".implement/**/*.ts",
					".implement/types/**/*.d.ts",
				],
				types: ["node", "vite/client"],
			}),
		},
		{ path: "vite.config.ts", contents: viteConfig(ctx) },
		{
			path: "src/index.html",
			contents: indexHtml({ title: ctx.name, entry: "/.implement/entry-client.ts" }),
		},
		{ path: "src/app.css", contents: appCss(ctx) },
		{ path: "scripts/sync.ts", contents: syncScript() },
		{ path: "src/routes/layout.ts", contents: layout(ctx) },
		{ path: "src/routes/index.ts", contents: page() },
		{ path: "src/routes/about/index.ts", contents: aboutPage(ctx) },
		{ path: "src/routes/error.ts", contents: errorPage(ctx) },
		{ path: "src/lib/counter.ts", contents: counter(ctx) },
		{ path: "static/favicon.svg", contents: favicon() },
		{ path: ".gitignore", contents: gitignore() },
		{ path: "README.md", contents: readme(ctx) },
	],
};

function pkg(ctx: TemplateContext): string {
	const deps: Dependency[] = ["@implementjs/core"];
	if (hasAddon(ctx, "primitives")) deps.push("@implementjs/primitives");
	if (hasAddon(ctx, "icons")) deps.push("@implementjs/lucide");

	const devDeps: Dependency[] = ["@implementjs/kit", "@types/node", "typescript", "vite"];
	if (hasAddon(ctx, "tailwind")) devDeps.push("@tailwindcss/vite", "tailwindcss");

	return packageJson({
		name: ctx.name,
		scripts: {
			dev: "vite",
			build: "vite build",
			preview: "vite preview",
			sync: "node --experimental-strip-types scripts/sync.ts",
			// tsc needs the generated `.implement/` files, and a fresh clone has never run vite
			check: "node --experimental-strip-types scripts/sync.ts && tsc --noEmit",
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

function syncScript(): string {
	return (
		dedent`
		import { sync } from "@implementjs/kit/sync";

		// Writes .implement/ (entries, tsconfig, ./$types) without running vite, so \`check\` works on a
		// fresh clone. Keep any kit() options that affect codegen in step with vite.config.ts.
		sync(new URL("..", import.meta.url).pathname);
	` + "\n"
	);
}

function layout(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { router } from "$implement/router";`,
		`import { Div, Main, Nav } from "@implementjs/core";`,
		`import type { LayoutProps } from "./$types";`,
		`import "../app.css";`,
		``,
		`export default function Layout({ children }: LayoutProps) {`,
		`\treturn Div(`,
		`\t\tNav(`,
		`\t\t\t{ class: "${c.nav}" },`,
		`\t\t\trouter.Link({ class: "${c.navLink}", to: "/" }, "Home"),`,
		`\t\t\trouter.Link({ class: "${c.navLink}", to: "/about" }, "About"),`,
		`\t\t),`,
		`\t\tMain({ class: "${c.main}" }, children),`,
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
		``,
		`export default function Page() {`,
		`\treturn Div(`,
		`\t\t{ class: "${c.page}" },`,
		`\t\tH1({ class: "${c.title}" }, "About"),`,
		`\t\tP(`,
		`\t\t\t{ class: "${c.subtitle}" },`,
		`\t\t\t"This page is ",`,
		`\t\t\t"src/routes/about/index.ts",`,
		`\t\t\t" — every directory under src/routes with an index.ts is a route.",`,
		`\t\t),`,
		`\t\tA({ class: "${c.link}", href: "${DOCS_URL}" }, "Read the docs"),`,
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

	return counterComponent(ctx, { editPath: "src/lib/counter.ts", links });
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

		| Script    | What it does                                   |
		| --------- | ---------------------------------------------- |
		| \`dev\`     | Start the dev server (server rendered, HMR)    |
		| \`build\`   | Prerender the site into \`dist/\`                |
		| \`preview\` | Serve the build locally                        |
		| \`sync\`    | Regenerate \`.implement/\` without running vite  |
		| \`check\`   | Sync, then typecheck the app                   |

		## Structure

		\`\`\`
		${ctx.name}/
		├ src/
		│  ├ lib/            @/lib — components, helpers, state
		│  ├ routes/         the routing tree
		│  │  ├ about/
		│  │  │  └ index.ts  → /about
		│  │  ├ error.ts     the 404 / render error page
		│  │  ├ index.ts     → /
		│  │  └ layout.ts    wraps every page
		│  ├ app.css         global styles, imported from the root layout
		│  └ index.html      the shell, pointed at the generated client entry
		└ static/            served from the site root
		\`\`\`

		\`index.ts\` is a page, \`layout.ts\` wraps everything below it, and \`[param]\` / \`[...rest]\`
		directories bind params. Kit generates \`.implement/\` (entries, the tsconfig this app extends, and
		a \`./$types\` for every route) — it is gitignored and regenerates itself, so nothing in there
		needs editing.
	` + "\n"
	);
}
