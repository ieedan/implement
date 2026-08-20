import { Div, H4, P } from "@implementjs/core";
import { Separator } from "@/lib/components/ui/separator";

export default function SeparatorDemo() {
	return Div(
		{ class: "w-full max-w-md" },
		Div(
			{ class: "space-y-1" },
			H4({ class: "text-sm leading-none font-medium" }, "implement"),
			P(
				{ class: "text-sm text-muted-foreground" },
				"A signal-based UI framework with no compiler.",
			),
		),
		Separator({ class: "my-4" }),
		Div(
			{ class: "flex h-5 items-center space-x-4 text-sm" },
			Div({}, "Docs"),
			Separator({ orientation: "vertical" }),
			Div({}, "Tutorial"),
			Separator({ orientation: "vertical" }),
			Div({}, "REPL"),
		),
	);
}
