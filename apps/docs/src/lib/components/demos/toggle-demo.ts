import { Div } from "@implementjs/core";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "@implementjs/lucide";
import { Toggle } from "@/lib/components/ui/toggle";

export default function ToggleDemo() {
	return Div(
		{ class: "flex items-center gap-1" },
		Toggle({ pressed: true, "aria-label": "Toggle bold" }, BoldIcon({ "aria-hidden": true })),
		Toggle({ "aria-label": "Toggle italic" }, ItalicIcon({ "aria-hidden": true })),
		Toggle(
			{ "aria-label": "Toggle underline", disabled: true },
			UnderlineIcon({ "aria-hidden": true }),
		),
	);
}
