import { Div, Input, Label } from "@implementjs/core";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "@/lib/components/ui/dialog";

function Field(id: string, label: string, value: string) {
	return Div(
		{ class: "grid grid-cols-4 items-center gap-4" },
		Label({ for: id, class: "text-sm" }, label),
		Input({
			id,
			value,
			class:
				"col-span-3 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
		}),
	);
}

export default function DialogDemo() {
	return Dialog(
		{},
		DialogTrigger({ variant: "outline" }, "Edit profile"),
		DialogPortal(
			DialogOverlay({}),
			DialogContent(
				{},
				Div(
					{ class: "grid gap-1.5" },
					DialogTitle({}, "Edit profile"),
					DialogDescription({}, "Make changes to your profile here. Click save when you're done."),
				),
				Div(
					{ class: "grid gap-3" },
					Field("name", "Name", "Aidan Bleser"),
					Field("username", "Username", "@ieedan"),
				),
				DialogClose({ variant: "outline", class: "w-full" }, "Save changes"),
			),
		),
	);
}
