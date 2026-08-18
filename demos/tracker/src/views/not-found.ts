import { Div, Span, type Mountable } from "@implementjs/core";
import { router } from "../router";

/** Router fallback. Rendered without the app shell — fallbacks bypass layouts. */
export function NotFound(): Mountable {
	return Div(
		{ class: "flex h-dvh flex-col items-center justify-center gap-3" },
		Span({ class: "text-sm font-medium text-zinc-300" }, "This page does not exist."),
		router.Link(
			{ to: "/", class: "text-[13px] text-indigo-400 hover:text-indigo-300" },
			"Back to issues",
		),
	);
}
