import { Div, P } from "@implementjs/core";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "@/lib/components/ui/popover";

export default function PopoverTriggersDemo() {
	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-2" },
		Popover(
			PopoverTrigger({ variant: "outline" }, "Left"),
			PopoverTrigger({ variant: "outline" }, "Center"),
			PopoverTrigger({ variant: "outline" }, "Right"),
			PopoverPortal(
				PopoverContent(
					{ class: "w-64" },
					P({ class: "text-sm" }, "Opened from whichever trigger you clicked."),
				),
			),
		),
	);
}
