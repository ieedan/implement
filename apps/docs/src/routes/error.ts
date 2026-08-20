import { Div, P, Span, type Child } from "@implementjs/core";
import { router } from "@/lib/router";
import type { ErrorProps } from "./$types";

export default function ErrorPage({ error }: ErrorProps): Child {
	return Div(
		{ class: "flex flex-col items-center gap-2 py-24" },
		Span({ class: "text-sm font-medium" }, `${error.code} — ${error.message}`),
		P(
			{ class: "text-[13px] text-foreground/50" },
			error.code === 404 ? "This page doesn't exist. " : "Something went wrong. ",
			router.Link({ to: "/", class: "text-foreground/80 underline underline-offset-4" }, "Go home"),
		),
	);
}
