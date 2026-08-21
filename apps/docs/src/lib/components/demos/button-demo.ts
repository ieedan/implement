import { Div } from "@implementjs/core";
import { PlusIcon } from "@implementjs/lucide";
import { Button } from "@/lib/components/ui/button";

export default function ButtonDemo() {
	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-2" },
		Button("Default"),
		Button({ variant: "secondary" }, "Secondary"),
		Button({ variant: "outline" }, "Outline"),
		Button({ variant: "ghost" }, "Ghost"),
		Button({ variant: "destructive" }, "Destructive"),
		Button({ variant: "link" }, "Link"),
		Button({ variant: "outline", size: "sm" }, PlusIcon({ "aria-hidden": true }), "New"),
		Button({ size: "icon", "aria-label": "Add" }, PlusIcon({ "aria-hidden": true })),
		Button({ disabled: true }, "Disabled"),
	);
}
