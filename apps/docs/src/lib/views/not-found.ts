import { Div, P, Span, type Mountable } from "@implementjs/core";
import { router } from "$implement/router";

export function NotFound(): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2 py-24" },
		Span({ class: "text-sm font-medium" }, "Page not found"),
		P(
			{ class: "text-[13px] text-foreground/50" },
			"This page doesn't exist. ",
			router.Link({ to: "/", class: "text-foreground/80 underline underline-offset-4" }, "Go home"),
		),
	);
}
