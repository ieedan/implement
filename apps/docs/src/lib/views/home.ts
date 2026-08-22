import { A, Div, H1, ImplementHead, P, type Mountable } from "@implementjs/core";
import { Logo } from "../components/logo";
import { Link } from "../router";

export function Home(): Mountable {
	return Div(
		{ class: "mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6" },
		ImplementHead(
			ImplementHead.Title("implement ~ A dead simple ui framework"),
			ImplementHead.Meta({
				name: "description",
				content: "A simple ergonomic ui framework without a compiler.",
			}),
		),

		// `self-start` so the column's stretch does not widen the box the glyph centers in
		Logo({ class: "h-12 w-auto self-start", "aria-hidden": true }),
		H1({ class: "text-3xl font-semibold tracking-tight" }, "implement"),
		P({ class: "text-foreground/60" }, "A simple ergonomic ui framework without a compiler."),
		Div(
			{ class: "flex items-center gap-4" },
			Link({ to: "/docs", class: "text-foreground underline underline-offset-4" }, "Read the docs"),
			A(
				{
					href: "https://github.com/ieedan/implement",
					target: "_blank",
					class: "text-foreground/60 hover:underline underline-offset-4",
				},
				"View on GitHub →",
			),
		),
	);
}
