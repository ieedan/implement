import { Div, P, Span, type Mountable } from "@packages/implement";
import { router } from "../router";

export function NotFound(): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2 py-24" },
		Span({ class: "text-sm font-medium text-zinc-300" }, "Page not found"),
		P(
			{ class: "text-[13px] text-zinc-500" },
			"This page doesn't exist. ",
			router.Link({ to: "/", class: "text-zinc-300 underline underline-offset-4" }, "Go home"),
		),
	);
}
