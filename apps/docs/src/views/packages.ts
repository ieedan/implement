import { A, Div, H1, H2, H3, Implement, Main, P, Section, type Mountable } from "@implementjs/core";
import { SiteHeader } from "../components/site-header";
import { router } from "../router";

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
					"Signals, element helpers, and the router. Plain TypeScript that builds real DOM nodes, no compiler.",
				docs: { label: "Read the docs", to: "/docs" },
				sourceDir: "core",
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

function PackageCard(pkg: Package): Mountable {
	return Div(
		{
			class:
				"flex flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-colors hover:border-foreground/25",
		},
		H3({ class: "font-mono text-sm font-medium" }, pkg.name),
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

function PackageGroupSection(group: PackageGroup): Mountable {
	return Section(
		{ class: "flex flex-col gap-3" },
		Div(
			{ class: "flex flex-col gap-1" },
			H2({ class: "text-lg font-semibold tracking-tight" }, group.title),
			P({ class: "text-sm text-foreground/60" }, group.description),
		),
		Div(
			{ class: "grid grid-cols-1 gap-4 md:grid-cols-2" },
			...group.packages.map((pkg) => PackageCard(pkg)),
		),
	);
}

export function PackagesPage(): Mountable {
	return Div(
		{ class: "flex min-h-dvh flex-col" },
		Implement.Head(
			Implement.Head.Title("Packages ~ implement"),
			Implement.Head.Meta({
				name: "description",
				content: "The packages that make up implement, grouped by what they do.",
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
					"Everything ships from one repo as scoped packages. Start with the framework, then pull in the pieces you need.",
				),
			),
			Div(
				{ class: "mt-8 flex flex-col gap-10" },
				...groups.map((group) => PackageGroupSection(group)),
			),
		),
	);
}
