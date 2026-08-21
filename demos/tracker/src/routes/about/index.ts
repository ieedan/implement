import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		{ class: "flex min-h-dvh flex-col items-center justify-center gap-6 p-8" },
		H1({ class: "text-3xl font-semibold tracking-tight" }, "About"),
		P(
			{ class: "text-sm text-zinc-400" },
			"This page is ",
			"src/routes/about/index.ts",
			" — every directory under src/routes with an index.ts is a route.",
		),
		A({ class: "text-zinc-400 underline underline-offset-4 hover:text-zinc-200", href: "https://github.com/ieedan/implement" }, "Read the docs"),
	);
}
