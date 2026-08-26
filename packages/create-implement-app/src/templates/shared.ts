import dedent from "dedent";
import { hasAddon, type TemplateContext } from "@/templates/types";
import { call, json, object, property } from "@/utils/format";

/** implement has no docs site of its own yet, everything lives in the monorepo. */
export const DOCS_URL = "https://github.com/ieedan/implement";

/** The jsrepo registry the `ui` addon adds components from. */
export const UI_REGISTRY = "@implementjs/ui";

/** Where the generated `jsrepo.config.ts` puts each type of item, in both templates. */
export const UI_PATH = "src/lib/components/ui";
export const UI_LIB_PATH = "src/lib";

/**
 * Where the registry is built inside a clone of the implement repo. It is configured from the docs
 * app so that it resolves against the project its component files live in, so that — rather than
 * the repository root — is what `--link` points jsrepo's `fs` provider at.
 */
export const UI_REGISTRY_DIR = "apps/docs";

/** The script the `ui` addon adds, so adding a component is the same command in every app. */
export const UI_SCRIPT = "ui";

/**
 * The components the scaffolded app already uses, so a run that installs also ends with them on
 * disk. Everything else is `jsrepo add <name>` away.
 */
export const UI_ITEMS = ["button"];

/**
 * Where jsrepo reads `@implementjs/ui` from. `--link` points an app at a clone of the implement
 * repo, and the registry is built into that clone's `registry.json` — so the components come off
 * disk through jsrepo's `fs` provider, the same way the linked packages do.
 */
function uiRegistry(ctx: TemplateContext): string {
	if (ctx.linkRoot === undefined) return UI_REGISTRY;
	return `fs://${ctx.linkRoot}/${UI_REGISTRY_DIR}`;
}

/** The `jsrepo.config.ts` the `ui` addon writes: where components come from, and where they land. */
export function jsrepoConfig(ctx: TemplateContext): string {
	const linked = ctx.linkRoot !== undefined;

	return `${[
		linked
			? `import { DEFAULT_PROVIDERS, defineConfig } from "jsrepo";`
			: `import { defineConfig } from "jsrepo";`,
		...(linked ? [`import { fs } from "jsrepo/providers";`] : []),
		``,
		`export default defineConfig({`,
		...(linked
			? [
					`\t// the registry is read off disk, out of the linked implement clone — run \`pnpm registry\``,
					`\t// there after changing a component so the registry.json jsrepo reads is up to date`,
				]
			: []),
		`\tregistries: [${JSON.stringify(uiRegistry(ctx))}],`,
		...(linked ? [`\tproviders: [...DEFAULT_PROVIDERS, fs()],`] : []),
		`\t// every component is typed \`ui\`, and the \`cn\` they all share is a \`lib\``,
		`\tpaths: {`,
		`\t\tui: ${JSON.stringify(UI_PATH)},`,
		`\t\tlib: ${JSON.stringify(UI_LIB_PATH)},`,
		`\t},`,
		`});`,
	].join("\n")}\n`;
}

/**
 * The generated `package.json`.
 *
 * Where a dependency goes: vite bundles the app, so nothing a template writes is resolved out of
 * `node_modules` at runtime — but a kit app that later takes a server adapter is built with
 * `noExternal: [/^@implementjs\//]` and nothing else, so every other package it imports has to be
 * installed next to the built server. That is the line: a package the app's own code imports is a
 * dependency, and a package only the build or the editor ever loads — vite, tailwind, typescript,
 * the linters, kit's plugin, the schemas kit evaluates and inlines — is a devDependency.
 */
export function packageJson({
	name,
	scripts,
	dependencies,
	devDependencies,
}: {
	name: string;
	scripts: Record<string, string>;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
}): string {
	// the key order oxfmt puts a package.json in — `version` ahead of `private` — so the app's
	// first format leaves its manifest alone
	return json({
		name,
		version: "0.0.0",
		private: true,
		type: "module",
		scripts,
		dependencies,
		devDependencies,
	});
}

/**
 * pnpm blocks a dependency's install scripts until the project names it, and since pnpm 11 that is
 * a failed install rather than a warning. Vite's transformer, esbuild, fetches its platform binary
 * in a `postinstall` — so every generated app needs it allowed, or the very first `pnpm install`
 * stops with `ERR_PNPM_IGNORED_BUILDS`.
 *
 * `pnpm-workspace.yaml` is where the allowance lives, workspace or not.
 */
export function pnpmWorkspace(): string {
	return (
		dedent`
		# esbuild — vite's transformer — downloads its platform binary in a postinstall script.
		# Without this the install fails rather than quietly skipping it.
		allowBuilds:
		  esbuild: true
	` + "\n"
	);
}

/**
 * Whether the app needs its own {@link pnpmWorkspace}. An app scaffolded into the implement
 * monorepo resolves against the root one, and a second file there would make it a nested
 * workspace root.
 */
export function needsPnpmWorkspace(ctx: TemplateContext): boolean {
	return ctx.packageManager === "pnpm" && !ctx.workspace;
}

/** The extension that knows implement's call shapes. */
export const VSCODE_EXTENSION = "implementjs.implement-vscode";

/**
 * `.vscode/extensions.json`, which VS Code and Cursor read to prompt for the
 * extensions a project expects. Recommendations only — nothing installs itself,
 * and an editor that has never heard of the file ignores it.
 */
export function vscodeExtensions(ctx: TemplateContext): string {
	const recommendations = [VSCODE_EXTENSION];
	// Tailwind's class completion is only useful where the app has tailwind.
	if (hasAddon(ctx, "tailwind")) recommendations.push("bradlc.vscode-tailwindcss");

	return json({ recommendations });
}

/**
 * The class strings the tailwind extension cannot find on its own.
 *
 * implement has no JSX, so there is no `class="..."` attribute to key off — a class is an object
 * property in a call (`Div({ class: "flex gap-2" }, ...)`), and the extension's built in attribute
 * matching never sees it. Each entry is a regex the extension runs itself:
 *
 * - the first matches `class:` / `className:` followed by a quoted string, which is every class
 *   written inline in a component;
 * - the second is the two part form — find a `styles = { ... }` object, then treat every quoted
 *   string inside it as classes. That is the shape the generated components keep their classes in,
 *   and without it the object the app actually edits is the one place with no completions.
 */
const TAILWIND_CLASS_REGEX: string[][] = [
	["(?:class(?:Name)?)\\s*:\\s*['\"`]([^'\"`]*)['\"`]"],
	["styles\\s*=\\s*\\{([^}]*)\\}", "['\"`]([^'\"`]*)['\"`]"],
];

/**
 * The helpers the `ui` addon's components pass classes through — `cn()` merges them and `tv()`
 * holds the variant tables. Naming them here is what makes `cn("flex gap-2")` complete like a
 * class attribute would.
 */
const TAILWIND_CLASS_FUNCTIONS = ["cn", "tv"];

/**
 * `.vscode/settings.json`, written only for a tailwind app: what it configures is the tailwind
 * extension {@link vscodeExtensions} recommends, and it is the difference between that extension
 * being installed and it doing anything in an implement component.
 *
 * `quickSuggestions.strings` comes with it because every class here is inside a string literal,
 * where VS Code does not offer completions unless it is asked to.
 */
export function vscodeSettings(ctx: TemplateContext): string {
	return json({
		"editor.quickSuggestions": { strings: "on" },
		...(hasAddon(ctx, "ui") ? { "tailwindCSS.classFunctions": TAILWIND_CLASS_FUNCTIONS } : {}),
		"tailwindCSS.experimental.classRegex": TAILWIND_CLASS_REGEX,
	});
}

export function gitignore(): string {
	return (
		dedent`
		node_modules
		dist
		.DS_Store
		*.local
		.env
		.env.*
		!.env.example
	` + "\n"
	);
}

export function indexHtml(
	ctx: TemplateContext,
	{ title, entry }: { title: string; entry: string },
): string {
	// a dark-only app says so; with mode-watcher the page renders either way
	const colorScheme = hasAddon(ctx, "modeWatcher") ? "light dark" : "dark";

	return (
		dedent`
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${title}</title>
				<meta name="color-scheme" content="${colorScheme}" />
				<script type="module" src="${entry}"></script>
			</head>
			<body id="root"></body>
		</html>
	` + "\n"
	);
}

/**
 * The tailwind utilities that carry no color, keyed the same as {@link styles}. The colors live in
 * {@link TAILWIND_PALETTE}, which is where the two modes differ.
 */
const TAILWIND_BASE: Record<string, string> = {
	page: "flex min-h-dvh flex-col items-center justify-center gap-6 p-8",
	title: "text-3xl font-semibold tracking-tight",
	subtitle: "text-sm",
	code: "rounded px-1.5 py-0.5 font-mono text-xs",
	counter: "flex items-center gap-4",
	button:
		"flex size-9 cursor-pointer items-center justify-center rounded-md border text-lg leading-none",
	count: "min-w-10 text-center font-mono text-2xl tabular-nums",
	trigger: "cursor-pointer text-sm",
	panel: "pt-3",
	links: "flex flex-col items-center gap-1 text-sm",
	link: "underline underline-offset-4",
	nav: "flex items-center justify-center gap-4 border-b p-4 text-sm",
	navLink: "",
	main: "flex-1",
	form: "flex w-full max-w-xs flex-col gap-4",
	field: "flex flex-col gap-1.5",
	label: "text-sm font-medium",
	input: "rounded-md border px-3 py-2 text-sm outline-none",
	error: "min-h-4 text-xs",
	submit: "cursor-pointer rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
	success: "text-sm",
};

/** The dimmed text three of the entries below share. */
const MUTED_TEXT = {
	light: "text-zinc-500 hover:text-zinc-900",
	dark: "text-zinc-400 hover:text-zinc-200",
};

/**
 * The tailwind utilities that differ between the modes. A dark-only app renders the `dark` half
 * bare; with the mode-watcher addon the `light` half renders bare and the `dark` half moves behind
 * the `dark:` variant, which the generated `app.css` points at the class on `<html>`.
 */
const TAILWIND_PALETTE: Record<string, { light: string; dark: string }> = {
	subtitle: { light: "text-zinc-500", dark: "text-zinc-400" },
	code: { light: "bg-zinc-100 text-zinc-700", dark: "bg-zinc-900 text-zinc-300" },
	button: {
		light: "border-zinc-200 bg-zinc-50 hover:bg-zinc-100",
		dark: "border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
	},
	trigger: MUTED_TEXT,
	link: MUTED_TEXT,
	nav: { light: "border-zinc-200", dark: "border-zinc-800" },
	navLink: MUTED_TEXT,
	label: { light: "text-zinc-700", dark: "text-zinc-300" },
	input: {
		light: "border-zinc-200 bg-white focus:border-zinc-400",
		dark: "border-zinc-800 bg-zinc-900 focus:border-zinc-600",
	},
	error: { light: "text-red-600", dark: "text-red-400" },
	submit: {
		light: "bg-zinc-900 text-zinc-50 hover:bg-zinc-800",
		dark: "bg-zinc-100 text-zinc-900 hover:bg-white",
	},
	success: { light: "text-emerald-600", dark: "text-emerald-400" },
};

/**
 * The same entries as {@link TAILWIND_PALETTE}, written against the tokens `@implementjs/ui` runs
 * on. One value per key rather than a light and a dark one: the tokens themselves are what change
 * between the modes, so nothing here needs a `dark:` variant.
 */
const UI_PALETTE: Record<string, string> = {
	subtitle: "text-muted-foreground",
	code: "bg-muted text-muted-foreground",
	button: "border-input bg-background hover:bg-accent hover:text-accent-foreground",
	trigger: "text-muted-foreground hover:text-foreground",
	link: "text-muted-foreground hover:text-foreground",
	nav: "border-border",
	navLink: "text-muted-foreground hover:text-foreground",
	label: "text-foreground",
	input: "border-input bg-background focus:border-ring",
	error: "text-destructive",
	submit: "bg-primary text-primary-foreground hover:bg-primary/90",
	success: "text-muted-foreground",
};

/**
 * The tokens every `@implementjs/ui` component reads. They are named once here and turned into
 * tailwind colors by the `@theme inline` block, which is what makes `bg-popover` and `ring-ring/50`
 * compile at all.
 */
const UI_TOKENS = {
	light: {
		"--background": "#fff",
		"--foreground": "#000",
		"--card": "#fff",
		"--card-foreground": "#000",
		"--popover": "#fff",
		"--popover-foreground": "#000",
		"--primary": "#000",
		"--primary-foreground": "#fff",
		"--secondary": "#f5f5f5",
		"--secondary-foreground": "#000",
		"--muted": "#f5f5f5",
		"--muted-foreground": "#737373",
		"--accent": "#f5f5f5",
		"--accent-foreground": "#000",
		"--destructive": "oklch(0.577 0.245 27.325)",
		"--border": "#e5e5e5",
		"--input": "#e5e5e5",
		"--ring": "#000",
	},
	dark: {
		"--background": "#000",
		"--foreground": "#fff",
		"--card": "#000",
		"--card-foreground": "#fff",
		"--popover": "#000",
		"--popover-foreground": "#fff",
		"--primary": "#fff",
		"--primary-foreground": "#000",
		"--secondary": "#222",
		"--secondary-foreground": "#fff",
		"--muted": "#222",
		"--muted-foreground": "#a1a1a1",
		"--accent": "#222",
		"--accent-foreground": "#fff",
		"--destructive": "oklch(0.704 0.191 22.216)",
		"--border": "#222",
		"--input": "#222",
		"--ring": "#fff",
	},
};

/** The CSS custom properties the non-tailwind `app.css` defines, in each mode. */
const CSS_TOKENS = {
	light: {
		"--bg": "#ffffff",
		"--fg": "#18181b",
		"--muted": "#52525b",
		"--border": "#e4e4e7",
		"--surface": "#f4f4f5",
		"--surface-hover": "#e4e4e7",
	},
	dark: {
		"--bg": "#09090b",
		"--fg": "#f4f4f5",
		"--muted": "#a1a1aa",
		"--border": "#27272a",
		"--surface": "#18181b",
		"--surface-hover": "#27272a",
	},
};

/**
 * The class names the generated app uses. With tailwind they are utilities, without it they are
 * semantic names the generated `app.css` defines — the components read the same either way.
 */
export function styles(ctx: TemplateContext): Record<string, string> {
	if (!hasAddon(ctx, "tailwind")) {
		return {
			page: "page",
			title: "title",
			subtitle: "subtitle",
			code: "code",
			counter: "counter",
			button: "button",
			count: "count",
			trigger: "trigger",
			panel: "panel",
			links: "links",
			link: "link",
			nav: "nav",
			navLink: "nav-link",
			main: "main",
			form: "form",
			field: "field",
			label: "label",
			input: "input",
			error: "error",
			submit: "submit",
			success: "success",
		};
	}

	const dual = hasAddon(ctx, "modeWatcher");
	const ui = hasAddon(ctx, "ui");

	return Object.fromEntries(
		Object.entries(TAILWIND_BASE).map(([key, base]) => {
			const colors = ui ? uiColors(key) : paletteColors(key, { dual });
			return [key, [base, ...colors].filter((part) => part !== "").join(" ")];
		}),
	);
}

/** The token classes for one {@link TAILWIND_BASE} entry, when the `ui` addon is on. */
function uiColors(key: string): string[] {
	const palette = UI_PALETTE[key];
	return palette === undefined ? [] : [palette];
}

/**
 * The zinc classes for one {@link TAILWIND_BASE} entry. A dark-only app renders the dark half
 * bare; with the mode-watcher addon the light half renders bare and the dark half moves behind the
 * `dark:` variant.
 */
function paletteColors(key: string, { dual }: { dual: boolean }): string[] {
	const palette = TAILWIND_PALETTE[key];
	if (palette === undefined) return [];
	if (!dual) return [palette.dark];
	return [palette.light, ...palette.dark.split(" ").map((name) => `dark:${name}`)];
}

function cssBlock(selector: string, tokens: Record<string, string>): string {
	return [
		`${selector} {`,
		...Object.entries(tokens).map(([name, value]) => `\t${name}: ${value};`),
		`}`,
	].join("\n");
}

/** `:root { ... }` (plus a `.dark { ... }` when both modes are in play). */
function cssTokens(dual: boolean): string {
	if (!dual) {
		return cssBlock(":root", { "color-scheme": "dark", ...CSS_TOKENS.dark });
	}

	return [
		"/* @implementjs/mode-watcher puts `dark` on <html>, and sets color-scheme itself */",
		cssBlock(":root", CSS_TOKENS.light),
		"",
		cssBlock(".dark", CSS_TOKENS.dark),
	].join("\n");
}

function tailwindCss(dual: boolean): string {
	const lines = [`@import "tailwindcss";`, ``, `@source ".";`, ``];

	if (dual) {
		// tailwind resolves `dark:` from prefers-color-scheme by default, which ignores the choice
		// the visitor made — point it at the class mode-watcher puts on <html> instead
		lines.push(
			`/* dark mode is a class on <html>, put there by @implementjs/mode-watcher */`,
			`@custom-variant dark (&:where(.dark, .dark *));`,
			``,
		);
	} else {
		lines.push(`html {`, `\tcolor-scheme: dark;`, `}`, ``);
	}

	const body = dual
		? "min-h-dvh bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100"
		: "min-h-dvh bg-zinc-950 text-zinc-100 antialiased";
	const selection = dual
		? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
		: "bg-zinc-700 text-zinc-50";

	lines.push(
		`body {`,
		`\t@apply ${body};`,
		`}`,
		``,
		`::selection {`,
		`\t@apply ${selection};`,
		`}`,
	);

	return `${lines.join("\n")}\n`;
}

/** `@theme inline`: one tailwind color per token, plus the keyframes two components animate to. */
function uiTheme(): string {
	return [
		"@theme inline {",
		...Object.keys(UI_TOKENS.light).map(
			(token) => `\t--color-${token.slice("--".length)}: var(${token});`,
		),
		"",
		"\t/* Accordion and Collapsible animate to a height the primitive measures onto the element at",
		"\t   runtime. Without these they still open and close, they just snap instead of sliding. */",
		"\t--animate-accordion-down: accordion-down 0.2s ease-out;",
		"\t--animate-accordion-up: accordion-up 0.2s ease-out;",
		"\t--animate-collapsible-down: collapsible-down 0.2s ease-out;",
		"\t--animate-collapsible-up: collapsible-up 0.2s ease-out;",
		...["accordion", "collapsible"].flatMap((name) => [
			"",
			`\t@keyframes ${name}-down {`,
			`\t\tfrom {`,
			`\t\t\theight: 0;`,
			`\t\t}`,
			`\t\tto {`,
			`\t\t\theight: var(--ip-${name}-content-height);`,
			`\t\t}`,
			`\t}`,
			"",
			`\t@keyframes ${name}-up {`,
			`\t\tfrom {`,
			`\t\t\theight: var(--ip-${name}-content-height);`,
			`\t\t}`,
			`\t\tto {`,
			`\t\t\theight: 0;`,
			`\t\t}`,
			`\t}`,
		]),
		"}",
	].join("\n");
}

/**
 * The stylesheet `@implementjs/ui` needs: the tokens every component reads, the `@theme` block that
 * turns them into tailwind colors, and the base layer the components assume — `border` with no
 * color in a component file means the token, which only holds because of the `*` rule below.
 */
function uiCss(dual: boolean): string {
	const blocks = [`@import "tailwindcss";`, ``, `@source ".";`, ``];

	if (dual) {
		blocks.push(
			`/* dark mode is a class on <html>, put there by @implementjs/mode-watcher */`,
			`@custom-variant dark (&:where(.dark, .dark *));`,
			``,
			cssBlock(":root", UI_TOKENS.light),
			``,
			cssBlock(".dark", UI_TOKENS.dark),
			``,
		);
	} else {
		blocks.push(
			`@custom-variant dark (&:where(.dark, .dark *));`,
			``,
			cssBlock(":root", { "color-scheme": "dark", ...UI_TOKENS.dark }),
			``,
		);
	}

	blocks.push(
		uiTheme(),
		``,
		`@layer base {`,
		`\t* {`,
		`\t\t@apply border-border;`,
		`\t}`,
		``,
		`\thtml {`,
		`\t\t@apply antialiased;`,
		`\t}`,
		``,
		`\tbody {`,
		`\t\t@apply min-h-dvh bg-background text-foreground;`,
		`\t}`,
		`}`,
	);

	return `${blocks.join("\n")}\n`;
}

export function appCss(ctx: TemplateContext): string {
	const dual = hasAddon(ctx, "modeWatcher");
	if (hasAddon(ctx, "ui")) return uiCss(dual);
	if (hasAddon(ctx, "tailwind")) return tailwindCss(dual);

	return `${cssTokens(dual)}\n\n${dedent`
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			min-height: 100dvh;
			background: var(--bg);
			color: var(--fg);
			font-family: ui-sans-serif, system-ui, sans-serif;
			-webkit-font-smoothing: antialiased;
		}

		.page {
			display: flex;
			min-height: 100dvh;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 1.5rem;
			padding: 2rem;
		}

		.title {
			margin: 0;
			font-size: 1.875rem;
			font-weight: 600;
			letter-spacing: -0.025em;
		}

		.subtitle {
			margin: 0;
			font-size: 0.875rem;
			color: var(--muted);
		}

		.code {
			border-radius: 0.25rem;
			background: var(--surface);
			padding: 0.125rem 0.375rem;
			font-family: ui-monospace, monospace;
			font-size: 0.75rem;
		}

		.counter {
			display: flex;
			align-items: center;
			gap: 1rem;
		}

		.button {
			display: flex;
			height: 2.25rem;
			width: 2.25rem;
			cursor: pointer;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--border);
			border-radius: 0.375rem;
			background: var(--surface);
			color: inherit;
			font-size: 1.125rem;
			line-height: 1;
		}

		.button:hover {
			background: var(--surface-hover);
		}

		.count {
			min-width: 2.5rem;
			text-align: center;
			font-family: ui-monospace, monospace;
			font-size: 1.5rem;
			font-variant-numeric: tabular-nums;
		}

		.trigger {
			cursor: pointer;
			border: none;
			background: none;
			color: var(--muted);
			font-size: 0.875rem;
		}

		.panel {
			padding-top: 0.75rem;
		}

		.links {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
			font-size: 0.875rem;
		}

		.link,
		.nav-link {
			color: var(--muted);
		}

		.nav {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 1rem;
			border-bottom: 1px solid var(--border);
			padding: 1rem;
			font-size: 0.875rem;
		}

		.main {
			flex: 1;
		}

		.form {
			display: flex;
			width: 100%;
			max-width: 20rem;
			flex-direction: column;
			gap: 1rem;
		}

		.field {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		.label {
			font-size: 0.875rem;
			font-weight: 500;
		}

		.input {
			border: 1px solid var(--border);
			border-radius: 0.375rem;
			background: var(--surface);
			padding: 0.5rem 0.75rem;
			color: inherit;
			font: inherit;
			font-size: 0.875rem;
		}

		.input:focus {
			border-color: var(--muted);
			outline: none;
		}

		.error {
			min-height: 1rem;
			color: #f87171;
			font-size: 0.75rem;
		}

		.submit {
			cursor: pointer;
			border: none;
			border-radius: 0.375rem;
			background: var(--fg);
			padding: 0.5rem 0.75rem;
			color: var(--bg);
			font-size: 0.875rem;
			font-weight: 500;
		}

		.submit:disabled {
			opacity: 0.5;
		}

		.success {
			color: #34d399;
			font-size: 0.875rem;
		}
	`}\n`;
}

export type Link = { label: string; href: string };

/**
 * The counter every template opens with — a signal, two buttons, and a list of links. Which pieces
 * it renders depends on the addons: icons swap the button labels for lucide icons and primitives
 * tuck the links into a collapsible.
 */
export function counterComponent(
	ctx: TemplateContext,
	{
		editPath,
		links,
		formImport,
		modeImport,
		uiImport,
	}: {
		editPath: string;
		links: Link[];
		formImport: string;
		modeImport: string;
		uiImport: string;
	},
): string {
	const c = styles(ctx);
	const icons = hasAddon(ctx, "icons");
	const primitives = hasAddon(ctx, "primitives");
	const forms = hasAddon(ctx, "forms");
	const modeWatcher = hasAddon(ctx, "modeWatcher");
	// the styled Button is the counter's buttons, so the bare element from core is not imported
	const ui = hasAddon(ctx, "ui");

	const coreImports = [
		"A",
		...(ui ? [] : ["Button"]),
		"Code",
		"Div",
		"H1",
		"Li",
		"P",
		"Span",
		"Ul",
		"signal",
	];

	const lines: string[] = [`import { ${coreImports.join(", ")} } from "@implementjs/core";`];
	if (icons) lines.push(`import { MinusIcon, PlusIcon } from "@implementjs/lucide";`);
	if (primitives) {
		lines.push(
			`import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";`,
		);
	}
	if (ui) lines.push(`import { Button } from ${JSON.stringify(uiImport)};`);
	if (modeWatcher) lines.push(`import { ModeToggle } from ${JSON.stringify(modeImport)};`);
	if (forms) lines.push(`import { SignUpForm } from ${JSON.stringify(formImport)};`);

	// the class names live in one object so the components below stay readable
	const used = [
		"page",
		"title",
		"subtitle",
		"code",
		"counter",
		...(ui ? [] : ["button"]),
		"count",
		"links",
		"link",
	];
	if (primitives) used.push("trigger", "panel");

	lines.push(
		``,
		`const styles = {`,
		...used.map((key) => property(`${key}: ${JSON.stringify(c[key])}`, 1)),
		`};`,
		``,
		`const links = [`,
		...links.flatMap((link) =>
			object([`label: ${JSON.stringify(link.label)}`, `href: ${JSON.stringify(link.href)}`], 1),
		),
		`];`,
		``,
	);

	const label = (sign: "minus" | "plus"): string => {
		if (!icons) return sign === "minus" ? `"−"` : `"+"`;
		return sign === "minus" ? `MinusIcon({ class: "size-4" })` : `PlusIcon({ class: "size-4" })`;
	};

	// the styled Button carries its own look, so it takes a variant instead of a class
	const buttonProps = (direction: "Decrement" | "Increment"): string[] => {
		const onClick = `onClick: () => count.${direction === "Decrement" ? "decrement" : "increment"}()`;
		const look = ui ? [`variant: "outline"`, `size: "icon"`] : [`class: styles.button`];
		return [...look, `"aria-label": "${direction}"`, onClick];
	};

	lines.push(
		`export function Counter() {`,
		`\tconst count = signal(0);`,
		``,
		`\treturn Div(`,
		`\t\t{ class: styles.page },`,
		`\t\tH1({ class: styles.title }, "implement"),`,
		`\t\tP(`,
		`\t\t\t{ class: styles.subtitle },`,
		`\t\t\t"Edit ",`,
		`\t\t\tCode({ class: styles.code }, ${JSON.stringify(editPath)}),`,
		`\t\t\t" and save to see it update.",`,
		`\t\t),`,
		`\t\tDiv(`,
		`\t\t\t{ class: styles.counter },`,
		...call("Button", buttonProps("Decrement"), [label("minus")], 3),
		`\t\t\tSpan({ class: styles.count }, count),`,
		...call("Button", buttonProps("Increment"), [label("plus")], 3),
		`\t\t),`,
		...(modeWatcher ? [`\t\tModeToggle(),`] : []),
		...(forms ? [`\t\tSignUpForm(),`] : []),
		`\t\tLinks(),`,
		`\t);`,
		`}`,
		``,
	);

	const list = [
		`\tUl(`,
		`\t\t{ class: styles.links },`,
		`\t\t...links.map((link) => Li(A({ class: styles.link, href: link.href }, link.label))),`,
		`\t)`,
	];

	if (primitives) {
		lines.push(
			`/** The links, tucked into a headless collapsible from @implementjs/primitives. */`,
			`function Links() {`,
			`\treturn Collapsible(`,
			`\t\t{},`,
			`\t\tCollapsibleTrigger({ class: styles.trigger }, "What's next?"),`,
			`\t\tCollapsibleContent(`,
			`\t\t\t{ class: styles.panel },`,
			...list.map(
				(line, i) => `\t\t\t${line.replace(/^\t/, "")}${i === list.length - 1 ? "," : ""}`,
			),
			`\t\t),`,
			`\t);`,
			`}`,
		);
	} else {
		lines.push(
			`function Links() {`,
			`\treturn ${list[0]?.trimStart()}`,
			...list.slice(1, -1),
			`\t);`,
			`}`,
		);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * The module the `modeWatcher` addon adds: the manager the app shares, and a button that flips it.
 * The manager sits at module scope so any part of the app can import it and change the mode —
 * a mounted `ModeWatcher` is what turns what it holds into a class on `<html>`.
 */
export function modeModule(ctx: TemplateContext): string {
	const c = styles(ctx);

	return `${[
		`import { Button } from "@implementjs/core";`,
		`import { createModeManager } from "@implementjs/mode-watcher";`,
		``,
		`const styles = {`,
		property(`toggle: ${JSON.stringify(c.trigger)}`, 1),
		`};`,
		``,
		`/** Module scope, so anything can import it and change the mode. */`,
		`export const mode = createModeManager();`,
		``,
		`/** Flips between light and dark, starting from whatever is rendering right now. */`,
		`export function ModeToggle() {`,
		`\treturn Button(`,
		`\t\t{ class: styles.toggle, onClick: () => mode.toggleMode() },`,
		`\t\t// undefined during a server render, where there is no operating system to ask`,
		`\t\tmode.mode.bind((current) => (current === "dark" ? "Light mode" : "Dark mode")),`,
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

/**
 * The sign up form the `forms` addon adds: a valibot schema, two fields, and the errors the
 * schema reports. Everything the form knows — the value, the error, whether it is submitting —
 * is a readable, so it binds straight into the DOM.
 */
export function signUpFormComponent(ctx: TemplateContext): string {
	const c = styles(ctx);
	const used = ["form", "field", "label", "input", "error", "submit", "success"];

	return `${[
		`import { Button, Div, Input, Label, Span, signal } from "@implementjs/core";`,
		`import { createForm, Field, Form } from "@implementjs/formish";`,
		`import * as v from "valibot";`,
		``,
		`const styles = {`,
		...used.map((key) => property(`${key}: ${JSON.stringify(c[key])}`, 1)),
		`};`,
		``,
		`const SignUpSchema = v.object({`,
		`\temail: v.pipe(v.string(), v.minLength(1, "Enter your email"), v.email("Enter a valid email")),`,
		`\tpassword: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),`,
		`});`,
		``,
		`export function SignUpForm() {`,
		`\tconst form = createForm({ schema: SignUpSchema });`,
		`\tconst signedUpAs = signal("");`,
		``,
		`\treturn Form(`,
		`\t\t{ class: styles.form, of: form, onSubmit: (output) => signedUpAs.set(output.email) },`,
		`\t\tTextField(form, "email", "Email", "email"),`,
		`\t\tTextField(form, "password", "Password", "password"),`,
		...call(
			"Button",
			[`class: styles.submit`, `type: "submit"`, `disabled: form.isSubmitting`],
			[`"Sign up"`],
			2,
		),
		...call(
			"Span",
			[`class: styles.success`],
			[`signedUpAs.bind((email) => (email ? \`Signed up as \${email}\` : ""))`],
			2,
		),
		`\t);`,
		`}`,
		``,
		`/** One labelled input, wired to the field at \`path\` and showing whatever the schema says about it. */`,
		`function TextField(`,
		`\tform: ReturnType<typeof createForm<typeof SignUpSchema>>,`,
		`\tpath: "email" | "password",`,
		`\tlabel: string,`,
		`\ttype: "email" | "password",`,
		`) {`,
		`\treturn Field({ of: form, path: [path] }, (field) =>`,
		`\t\tDiv(`,
		`\t\t\t{ class: styles.field },`,
		`\t\t\tLabel({ class: styles.label, htmlFor: path }, label),`,
		`\t\t\tInput({ ...field.props, class: styles.input, id: path, type, value: field.input }),`,
		`\t\t\tSpan({ class: styles.error }, field.error),`,
		`\t\t),`,
		`\t);`,
		`}`,
	].join("\n")}\n`;
}

/**
 * The ES version both templates compile against — `target` and the `lib` that comes with it.
 *
 * It has to keep up with the rules the `oxlint` adder turns on: `unicorn/no-array-sort` fixes an
 * `array.sort(...)` to `Array#toSorted()` and `unicorn/no-array-reverse` fixes `array.reverse()`
 * to `Array#toReversed()`, both of which arrived in ES2023. On ES2022 the two halves of the app
 * contradict each other — `pnpm lint` asks for a method `pnpm check` says does not exist — over
 * something as ordinary as sorting a list. `LINT_ES_VERSION`, next to those rules, is the
 * version they need, and a test holds this one at or above it.
 */
export const TARGET = "ES2023";

export function tsconfig({
	extend,
	include,
	types,
}: {
	extend?: string;
	include: string[];
	types: string[];
}): string {
	return json({
		...(extend ? { extends: extend } : {}),
		compilerOptions: {
			target: TARGET,
			lib: [TARGET, "DOM", "DOM.Iterable"],
			module: "ESNext",
			moduleResolution: "bundler",
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			isolatedModules: true,
			verbatimModuleSyntax: true,
			noUncheckedIndexedAccess: true,
			noUncheckedSideEffectImports: true,
			// the implement packages export their TypeScript source
			allowImportingTsExtensions: true,
			types,
		},
		include,
	});
}

/** The `plugins: [...]` entries a Vite config needs for the selected addons. */
export function vitePlugins(
	ctx: TemplateContext,
	plugins: string[],
): {
	imports: string[];
	plugins: string[];
} {
	if (!hasAddon(ctx, "tailwind")) return { imports: [], plugins };
	return {
		imports: [`import tailwindcss from "@tailwindcss/vite";`],
		plugins: ["tailwindcss()", ...plugins],
	};
}
