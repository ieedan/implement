import { Div, H4, Input, Label, P } from "@implementjs/core";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "@/lib/components/ui/popover";

function Field(id: string, label: string, value: string) {
	return Div(
		{ class: "grid grid-cols-3 items-center gap-4" },
		Label({ for: id, class: "text-sm" }, label),
		Input({
			id,
			value,
			class:
				"col-span-2 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
		}),
	);
}

export default function PopoverDemo() {
	return Popover(
		PopoverTrigger({ variant: "outline" }, "Open popover"),
		PopoverPortal(
			PopoverContent(
				{ class: "w-80" },
				Div(
					{ class: "grid gap-4" },
					Div(
						{ class: "space-y-2" },
						H4({ class: "leading-none font-medium" }, "Dimensions"),
						P({ class: "text-sm text-muted-foreground" }, "Set the dimensions for the layer."),
					),
					Div(
						{ class: "grid gap-2" },
						Field("width", "Width", "100%"),
						Field("maxWidth", "Max. width", "300px"),
						Field("height", "Height", "25px"),
						Field("maxHeight", "Max. height", "none"),
					),
					PopoverClose({ variant: "outline", class: "w-full" }, "Done"),
				),
			),
		),
	);
}
