import dedent from "dedent";
import {
	appCss,
	counterComponent,
	DOCS_URL,
	gitignore,
	indexHtml,
	packageJson,
	signUpFormComponent,
	tsconfig,
	vitePlugins,
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
		{
			path: "tsconfig.json",
			contents: tsconfig({ include: ["src/**/*.ts", "*.config.ts"], types: ["vite/client"] }),
		},
		{ path: "vite.config.ts", contents: viteConfig(ctx) },
		{ path: "src/index.html", contents: indexHtml({ title: ctx.name, entry: "/index.ts" }) },
		{ path: "src/app.css", contents: appCss(ctx) },
		{ path: "src/index.ts", contents: entry() },
		{ path: "src/counter.ts", contents: counter(ctx) },
		...(hasAddon(ctx, "forms")
			? [{ path: "src/sign-up-form.ts", contents: signUpFormComponent(ctx) }]
			: []),
		{ path: ".gitignore", contents: gitignore() },
		{ path: "README.md", contents: readme(ctx) },
	],
};

function pkg(ctx: TemplateContext): string {
	const deps: Dependency[] = ["@implementjs/core"];
	if (hasAddon(ctx, "primitives")) deps.push("@implementjs/primitives");
	if (hasAddon(ctx, "icons")) deps.push("@implementjs/lucide");
	if (hasAddon(ctx, "forms")) deps.push("@implementjs/formish", "valibot");

	const devDeps: Dependency[] = ["typescript", "vite"];
	if (hasAddon(ctx, "tailwind")) devDeps.push("@tailwindcss/vite", "tailwindcss");

	return packageJson({
		name: ctx.name,
		scripts: {
			dev: "vite",
			build: "vite build",
			preview: "vite preview",
			check: "tsc --noEmit",
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

function entry(): string {
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

	return counterComponent(ctx, {
		editPath: "src/counter.ts",
		links,
		formImport: "./sign-up-form",
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
