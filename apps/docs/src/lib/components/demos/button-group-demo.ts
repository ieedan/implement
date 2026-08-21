import { Div } from "@implementjs/core";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "@implementjs/lucide";
import { Button } from "@/lib/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
} from "@/lib/components/ui/button-group";
import { Input } from "@/lib/components/ui/input";

export default function ButtonGroupDemo() {
	return Div(
		{ class: "flex flex-col items-center gap-4" },
		ButtonGroup(
			Button({ variant: "outline", size: "icon-sm", "aria-label": "Bold" }, BoldIcon()),
			Button({ variant: "outline", size: "icon-sm", "aria-label": "Italic" }, ItalicIcon()),
			Button({ variant: "outline", size: "icon-sm", "aria-label": "Underline" }, UnderlineIcon()),
		),
		ButtonGroup(
			Button({ variant: "outline", size: "sm" }, "Merge"),
			ButtonGroupSeparator(),
			Button({ variant: "outline", size: "sm" }, "Squash"),
			Button({ variant: "outline", size: "sm" }, "Rebase"),
		),
		ButtonGroup(
			{ class: "w-full max-w-sm" },
			ButtonGroupText("https://"),
			Input({ placeholder: "example.com", "aria-label": "Site" }),
			Button({ variant: "outline" }, "Add"),
		),
	);
}
