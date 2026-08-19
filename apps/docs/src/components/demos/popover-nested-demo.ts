import { Div, P } from "@implementjs/core";
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from "@/components/ui/popover";

export default function PopoverNestedDemo() {
	return Popover(
		{},
		PopoverTrigger({ variant: "outline" }, "Open popover"),
		PopoverPortal(
			PopoverContent(
				{ class: "w-64" },
				Div(
					{ class: "grid gap-3" },
					P({ class: "text-sm" }, "This is the outer popover."),
					Popover(
						{},
						PopoverTrigger({ variant: "outline", class: "w-full" }, "Open nested"),
						PopoverPortal(
							{ disabled: true },
							PopoverContent(
								{ class: "w-56", side: "right" },
								P({ class: "text-sm" }, "This is nested inside the first one."),
							),
						),
					),
				),
			),
		),
	);
}
