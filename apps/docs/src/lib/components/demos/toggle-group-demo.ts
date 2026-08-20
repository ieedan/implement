import { signal } from "@implementjs/core";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "@implementjs/lucide";
import { ToggleGroup, ToggleGroupItem } from "@/lib/components/ui/toggle-group";

export default function ToggleGroupDemo() {
	const value = signal<string[]>(["bold"]);

	return ToggleGroup(
		{ type: "multiple", value, "aria-label": "Text formatting" },
		ToggleGroupItem(
			{ value: "bold", variant: "outline", "aria-label": "Toggle bold" },
			BoldIcon({ "aria-hidden": true }),
		),
		ToggleGroupItem(
			{ value: "italic", variant: "outline", "aria-label": "Toggle italic" },
			ItalicIcon({ "aria-hidden": true }),
		),
		ToggleGroupItem(
			{ value: "underline", variant: "outline", "aria-label": "Toggle underline" },
			UnderlineIcon({ "aria-hidden": true }),
		),
	);
}
