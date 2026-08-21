import { Div, Span } from "@implementjs/core";
import { Kbd, KbdGroup } from "@/lib/components/ui/kbd";

export default function KbdDemo() {
	return Div(
		{ class: "flex flex-col items-center gap-3 text-sm" },
		Div(
			{ class: "flex items-center gap-2" },
			Span({ class: "text-muted-foreground" }, "Open search"),
			KbdGroup(Kbd("⌘"), Kbd("K")),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Span({ class: "text-muted-foreground" }, "Toggle the sidebar"),
			KbdGroup(Kbd("Ctrl"), Kbd("B")),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Span({ class: "text-muted-foreground" }, "Then press"),
			KbdGroup(Kbd("G"), Span({ class: "text-muted-foreground" }, "then"), Kbd("H")),
		),
	);
}
