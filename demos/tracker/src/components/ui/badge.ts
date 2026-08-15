import { Span } from "@packages/ui";
import type { Label } from "../../api";

/** Pill with the label's color dot and name. */
export function LabelBadge(label: Label) {
	return Span(
		Span().style({ backgroundColor: label.color }).className("h-2 w-2 shrink-0 rounded-full"),
		Span().content(label.name),
	).className(
		"inline-flex select-none items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400",
	);
}
