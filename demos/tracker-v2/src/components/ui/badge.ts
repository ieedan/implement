import { Span, type Mountable, type Readable } from "@packages/ui_v2";
import type { Label } from "../../api";

/** Pill with the label's color dot and name, tracking a readable label. */
export function LabelBadge(label: Readable<Label>): Mountable {
	return Span(
		{
			class:
				"inline-flex select-none items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400",
		},
		Span({
			class: "h-2 w-2 shrink-0 rounded-full",
			style: { backgroundColor: label.bind("color") },
		}),
		Span({}, label.bind("name")),
	);
}
