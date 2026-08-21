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

	return Object.fromEntries(
		Object.entries(TAILWIND_BASE).map(([key, base]) => {
			const palette = TAILWIND_PALETTE[key];
			const colors = palette
				? dual
					? [palette.light, ...palette.dark.split(" ").map((name) => `dark:${name}`)]
					: [palette.dark]
				: [];
			return [key, [base, ...colors].filter((part) => part !== "").join(" ")];
		}),
	);
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

export function appCss(ctx: TemplateContext): string {
	const dual = hasAddon(ctx, "modeWatcher");
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
	}: { editPath: string; links: Link[]; formImport: string; modeImport: string },
): string {
	const c = styles(ctx);
	const icons = hasAddon(ctx, "icons");
	const primitives = hasAddon(ctx, "primitives");
	const forms = hasAddon(ctx, "forms");
	const modeWatcher = hasAddon(ctx, "modeWatcher");

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
	if (modeWatcher) lines.push(`import { ModeToggle } from ${JSON.stringify(modeImport)};`);
	if (forms) lines.push(`import { SignUpForm } from ${JSON.stringify(formImport)};`);

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
		`\ttoggle: ${JSON.stringify(c.trigger)},`,
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
		...used.map((key) => `\t${key}: ${JSON.stringify(c[key])},`),
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
		`\t\tButton({ class: styles.submit, type: "submit", disabled: form.isSubmitting }, "Sign up"),`,
		`\t\tSpan({ class: styles.success }, signedUpAs.bind((email) => (email ? \`Signed up as \${email}\` : ""))),`,
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
