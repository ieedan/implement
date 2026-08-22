import {
	A,
	derived,
	Div,
	H1,
	H2,
	H3,
	ImplementHead,
	Main,
	P,
	Section,
	Span,
	type Mountable,
	type Readable,
} from "@implementjs/core";
import type { PackageInfo } from "../../routes/packages/page.server";
import { SiteHeader } from "../components/site-header";
import { ogTags } from "../og-tags";
import { router } from "../router";

/** The packages route's server-load data: workspace manifests read off disk. */
export type PackagesData = { packages: Record<string, PackageInfo> };

/** Static routes only — `[param]` patterns would require Link params. */
type RoutePath = Exclude<Parameters<(typeof router)["Link"]>[0]["to"], `${string}:${string}`>;

type Package = {
	name: string;
	description: string;
	/** In-site docs link, if the package has docs. */
	docs?: { label: string; to: RoutePath };
	/** Path within the repo's packages/ directory. */
	sourceDir: string;
};

type PackageGroup = {
	title: string;
	description: string;
	packages: Package[];
};

const groups: PackageGroup[] = [
	{
		title: "Framework",
		description: "The core runtime everything else builds on.",
		packages: [
			{
				name: "@implementjs/core",
				description:
					"Signals, element helpers, and the pieces nodes are built out of. Plain TypeScript that builds real DOM nodes, no compiler.",
				docs: { label: "Read the docs", to: "/docs" },
				sourceDir: "core",
			},
			{
				name: "@implementjs/router",
				description:
					"The typed route-tree router: params as signals, persistent layouts, typed links, and URL-synced search params. Built on core's public API.",
				docs: { label: "Read the docs", to: "/docs" },
				sourceDir: "router",
			},
			{
				name: "@implementjs/kit",
				description:
					"File-based routing, SSR, and prerendering on top of Vite. Write pages and layouts as files; kit wires up the router with typed params.",
				docs: { label: "Read the docs", to: "/kit" },
				sourceDir: "kit",
			},
		],
	},
	{
		title: "Components",
		description: "Composable pieces you assemble into interfaces.",
		packages: [
			{
				name: "@implementjs/primitives",
				description:
					"Unstyled building blocks for common UI patterns. They own the behavior and the accessibility; you own the look.",
				docs: { label: "Browse the primitives", to: "/primitives" },
				sourceDir: "primitives",
			},
		],
	},
	{
		title: "Theming",
		description: "What decides which of your two palettes the page is wearing.",
		packages: [
			{
				name: "@implementjs/mode-watcher",
				description:
					"Dark mode: the visitor's choice, the system preference, and the class on <html> — applied before the first paint, so there is no flash of the wrong theme.",
				docs: { label: "Read the docs", to: "/mode-watcher" },
				sourceDir: "mode-watcher",
			},
		],
	},
	{
		title: "Forms",
		description: "State and validation for the parts of a page users type into.",
		packages: [
			{
				name: "@implementjs/formish",
				description:
					"Schema-first forms. The schema types the fields, validates the input and produces the submit handler's output — valibot, zod and arktype all fit.",
				docs: { label: "Read the docs", to: "/formish" },
				sourceDir: "formish",
			},
		],
	},
	{
		title: "Tooling",
		description: "What you reach for before the first line of app code.",
		packages: [
			{
				name: "create-implement-app",
				description:
					"Scaffolds a new implement app — kit or plain Vite, with Tailwind, primitives, icons, forms, and dark mode as optional addons.",
				docs: { label: "Read the docs", to: "/create" },
				sourceDir: "create-implement-app",
			},
			{
				name: "@implementjs/eslint",
				description:
					"Lint rules for the mistakes types cannot catch: a subscription whose unsubscribe went missing, a misspelled aria attribute, a Lifecycle that wanted to be a Watch. An ESLint plugin, and oxlint runs it too.",
				docs: { label: "Read the docs", to: "/eslint" },
				sourceDir: "eslint",
			},
		],
	},
	{
		title: "Icons",
		description: "Icon sets packaged as implement components.",
		packages: [
			{
				name: "@implementjs/lucide",
				description:
					"The full Lucide icon set as icon components. Each icon is its own module, so bundlers only keep the ones you import.",
				docs: { label: "Read the docs", to: "/lucide" },
				sourceDir: "lucide",
			},
		],
	},
];

function PackageCard(pkg: Package, data: Readable<PackagesData>): Mountable {
	const version = derived([data], (value) => {
		const info = value.packages?.[pkg.sourceDir];
		return info === undefined ? "" : `v${info.version}`;
	});
	return Div(
		{
			class:
				"flex flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-colors hover:border-foreground/25",
		},
		Div(
			{ class: "flex items-baseline justify-between gap-2" },
			H3({ class: "font-mono text-sm font-medium" }, pkg.name),
			Span({ class: "font-mono text-xs text-foreground/40" }, version),
		),
		P({ class: "flex-1 text-sm text-foreground/60" }, pkg.description),
		Div(
			{ class: "mt-1 flex items-center gap-4 text-sm" },
			pkg.docs
				? router.Link(
						{ to: pkg.docs.to, class: "text-foreground underline underline-offset-4" },
						pkg.docs.label,
					)
				: null,
			A(
				{
					href: `https://github.com/ieedan/implement/tree/main/packages/${pkg.sourceDir}`,
					target: "_blank",
					class: "text-foreground/60 underline-offset-4 hover:underline",
				},
				"Source →",
			),
		),
	);
}

function PackageGroupSection(group: PackageGroup, data: Readable<PackagesData>): Mountable {
	return Section(
		{ class: "flex flex-col gap-3" },
		Div(
			{ class: "flex flex-col gap-1" },
			H2({ class: "text-lg font-semibold tracking-tight" }, group.title),
			P({ class: "text-sm text-foreground/60" }, group.description),
		),
		Div(
			{ class: "grid grid-cols-1 gap-4 md:grid-cols-2" },
			...group.packages.map((pkg) => PackageCard(pkg, data)),
		),
	);
}

export function PackagesPage(data: Readable<PackagesData>): Mountable {
	return Div(
		{ class: "flex min-h-dvh flex-col" },
		ImplementHead(
			ImplementHead.Title("Packages ~ implement"),
			ImplementHead.Meta({
				name: "description",
				content: "The packages that make up implement, grouped by what they do.",
			}),
			...ogTags({
				title: "Packages ~ implement",
				description: "The packages that make up implement, grouped by what they do.",
				url: "/packages",
			}),
		),
		SiteHeader(),
		Main(
			{ class: "mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 md:px-8" },
			Div(
				{ class: "flex flex-col gap-2" },
				H1({ class: "text-3xl font-semibold tracking-tight" }, "Packages"),
				P(
					{ class: "max-w-xl text-foreground/60" },
					"Everything ships from one repo as separate packages. Start with the framework, then pull in the pieces you need.",
				),
			),
			Div(
				{ class: "mt-8 flex flex-col gap-10" },
				...groups.map((group) => PackageGroupSection(group, data)),
			),
		),
	);
}
