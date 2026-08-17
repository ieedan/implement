import { Div, H1, P, type Mountable } from "@packages/implement";
import { router } from "../router";

export function HomeView(): Mountable {
	return Div(
		{ class: "flex flex-col gap-4" },
		H1({ class: "text-2xl font-semibold tracking-tight" }, "Introduction"),
		P(
			{ class: "text-sm leading-6 text-zinc-400" },
			"implement is a signal-based UI framework with fine-grained reactivity, a typed router, and no compiler.",
		),
		P(
			{ class: "text-sm leading-6 text-zinc-400" },
			"Head to ",
			router.Link(
				{ to: "/docs/getting-started", class: "text-zinc-100 underline underline-offset-4" },
				"Getting Started",
			),
			" to build your first app.",
		),
	);
}
