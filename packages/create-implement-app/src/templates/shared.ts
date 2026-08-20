import dedent from "dedent";
import { hasAddon, type TemplateContext } from "@/templates/types";

/** implement has no docs site of its own yet, everything lives in the monorepo. */
export const DOCS_URL = "https://github.com/ieedan/implement";

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
	return `${JSON.stringify(
		{
			name,
			private: true,
			version: "0.0.0",
			type: "module",
			scripts,
			dependencies,
			devDependencies,
		},
		null,
		"\t",
	)}\n`;
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

export function indexHtml({ title, entry }: { title: string; entry: string }): string {
	return (
		dedent`
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${title}</title>
				<meta name="color-scheme" content="dark" />
				<script type="module" src="${entry}"></script>
			</head>
			<body id="root"></body>
		</html>
	` + "\n"
	);
}

/**
 * The class names the generated app uses. With tailwind they are utilities, without it they are
 * semantic names the generated `app.css` defines — the components read the same either way.
 */
export function styles(ctx: TemplateContext): Record<string, string> {
	if (hasAddon(ctx, "tailwind")) {
		return {
			page: "flex min-h-dvh flex-col items-center justify-center gap-6 p-8",
			title: "text-3xl font-semibold tracking-tight",
			subtitle: "text-sm text-zinc-400",
			code: "rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300",
			counter: "flex items-center gap-4",
			button:
				"flex size-9 cursor-pointer items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-lg leading-none hover:bg-zinc-800",
			count: "min-w-10 text-center font-mono text-2xl tabular-nums",
			trigger: "cursor-pointer text-sm text-zinc-400 hover:text-zinc-200",
			panel: "pt-3",
			links: "flex flex-col items-center gap-1 text-sm",
			link: "text-zinc-400 underline underline-offset-4 hover:text-zinc-200",
			nav: "flex items-center justify-center gap-4 border-b border-zinc-800 p-4 text-sm",
			navLink: "text-zinc-400 hover:text-zinc-200",
			main: "flex-1",
		};
	}

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
	};
}

export function appCss(ctx: TemplateContext): string {
	if (hasAddon(ctx, "tailwind")) {
		return (
			dedent`
			@import "tailwindcss";

			@source "./src";
			@source "./index.html";

			html {
				color-scheme: dark;
			}

			body {
				@apply min-h-dvh bg-zinc-950 text-zinc-100 antialiased;
			}

			::selection {
				@apply bg-zinc-700 text-zinc-50;
			}
		` + "\n"
		);
	}

	return (
		dedent`
		:root {
			color-scheme: dark;
			--bg: #09090b;
			--fg: #f4f4f5;
			--muted: #a1a1aa;
			--border: #27272a;
			--surface: #18181b;
		}

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
			background: #27272a;
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
	` + "\n"
	);
}

export type Link = { label: string; href: string };

/**
 * The counter every template opens with — a signal, two buttons, and a list of links. Which pieces
 * it renders depends on the addons: icons swap the button labels for lucide icons and primitives
 * tuck the links into a collapsible.
 */
export function counterComponent(
	ctx: TemplateContext,
	{ editPath, links }: { editPath: string; links: Link[] },
): string {
	const c = styles(ctx);
	const icons = hasAddon(ctx, "icons");
	const primitives = hasAddon(ctx, "primitives");

	const coreImports = ["A", "Button", "Code", "Div", "H1", "Li", "P", "Span", "Ul", "signal"];

	const lines: string[] = [`import { ${coreImports.join(", ")} } from "@implementjs/core";`];
	if (icons) lines.push(`import { MinusIcon, PlusIcon } from "@implementjs/lucide";`);
	if (primitives) {
		lines.push(
			`import {`,
			`\tCollapsible,`,
			`\tCollapsibleContent,`,
			`\tCollapsibleTrigger,`,
			`} from "@implementjs/primitives";`,
		);
	}

	// the class names live in one object so the components below stay readable
	const used = ["page", "title", "subtitle", "code", "counter", "button", "count", "links", "link"];
	if (primitives) used.push("trigger", "panel");

	lines.push(
		``,
		`const styles = {`,
		...used.map((key) => `\t${key}: ${JSON.stringify(c[key])},`),
		`};`,
		``,
		`const links = [`,
		...links.map(
			(link) => `\t{ label: ${JSON.stringify(link.label)}, href: ${JSON.stringify(link.href)} },`,
		),
		`];`,
		``,
	);

	const label = (sign: "minus" | "plus"): string => {
		if (!icons) return sign === "minus" ? `"−"` : `"+"`;
		return sign === "minus" ? `MinusIcon({ class: "size-4" })` : `PlusIcon({ class: "size-4" })`;
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
		`\t\t\tButton(`,
		`\t\t\t\t{ class: styles.button, "aria-label": "Decrement", onClick: () => count.decrement() },`,
		`\t\t\t\t${label("minus")},`,
		`\t\t\t),`,
		`\t\t\tSpan({ class: styles.count }, count),`,
		`\t\t\tButton(`,
		`\t\t\t\t{ class: styles.button, "aria-label": "Increment", onClick: () => count.increment() },`,
		`\t\t\t\t${label("plus")},`,
		`\t\t\t),`,
		`\t\t),`,
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

export function tsconfig({
	extend,
	include,
	types,
}: {
	extend?: string;
	include: string[];
	types: string[];
}): string {
	return `${JSON.stringify(
		{
			...(extend ? { extends: extend } : {}),
			compilerOptions: {
				target: "ES2022",
				lib: ["ES2022", "DOM", "DOM.Iterable"],
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
		},
		null,
		"\t",
	)}\n`;
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
