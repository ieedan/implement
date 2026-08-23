import { Div, If, Input, Label, P, mediaQuery } from "@implementjs/core";
import {
	ResponsiveDialog,
	ResponsiveDialogClose,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogTitle,
	ResponsiveDialogTrigger,
	RESPONSIVE_DIALOG_QUERY,
} from "@/lib/components/ui/responsive-dialog";

function Field(id: string, label: string, value: string) {
	return Div(
		{ class: "grid gap-2" },
		Label({ for: id, class: "text-sm" }, label),
		Input({
			id,
			value,
			class:
				"h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
		}),
	);
}

export default function ResponsiveDialogDemo() {
	const isMobile = mediaQuery(RESPONSIVE_DIALOG_QUERY);

	return Div(
		{ class: "flex flex-col items-center gap-3" },
		ResponsiveDialog(
			ResponsiveDialogTrigger("Edit profile"),
			ResponsiveDialogContent(
				Div(
					{ class: "mx-auto flex w-full max-w-sm flex-col gap-6 p-4 pb-8 sm:p-0" },
					Div(
						{ class: "grid gap-1.5" },
						ResponsiveDialogTitle("Edit profile"),
						ResponsiveDialogDescription("Make changes to your profile here."),
					),
					Div(
						{ class: "grid gap-3" },
						Field("responsive-name", "Name", "Aidan Bleser"),
						Field("responsive-username", "Username", "@ieedan"),
					),
					ResponsiveDialogClose({ variant: "default" }, "Save changes"),
				),
			),
		),
		P(
			{ class: "text-xs text-muted-foreground" },
			"Currently a ",
			If(isMobile).Then("drawer").Else("dialog"),
			". Narrow the window past 768px to swap it.",
		),
	);
}
