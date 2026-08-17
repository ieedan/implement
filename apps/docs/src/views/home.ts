import { A, Div, H1, Implement, P, type Mountable } from "@packages/implement";
import { Link } from "../router";

export function Home(): Mountable {
	return Div(
		{ class: "mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6" },
		Implement.Head(
			Implement.Head.Title("implement ~ A dead simple ui framework"),
			Implement.Head.Meta({ name: "description", content: "A signal based UI framework with fine-grained reactivity, good ergonomics, and no compiler." }),
		),

		H1({ class: "text-3xl font-semibold tracking-tight" }, "implement"),
		P(
			{ class: "text-foreground/60" },
			"A signal-based UI framework with fine-grained reactivity, good ergonomics, and no compiler.",
		),
		Div({ class: "flex items-center gap-4" },
			Link(
				{ to: "/docs", class: "text-foreground underline underline-offset-4" },
				"Read the docs",
			),
			A(
				{ href: "https://github.com/ieedan/implement", target: "_blank", class: "text-foreground/60 hover:underline underline-offset-4" },
				"View on GitHub →",
			),
		)
	);
}
