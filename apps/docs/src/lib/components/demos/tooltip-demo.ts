import { Div } from "@implementjs/core";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipProvider,
	TooltipTrigger,
} from "@/lib/components/ui/tooltip";

export default function TooltipDemo() {
	return TooltipProvider(
		{},
		Div(
			{ class: "flex items-center gap-2" },
			Tooltip(
				{},
				TooltipTrigger({ variant: "outline" }, "Hover"),
				TooltipPortal(TooltipContent({}, "Add to library")),
			),
			Tooltip(
				{},
				TooltipTrigger({ variant: "outline" }, "Or hover this"),
				TooltipPortal(TooltipContent({}, "No delay the second time")),
			),
		),
	);
}
