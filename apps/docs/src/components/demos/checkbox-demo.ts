import { Div, Label } from "@implementjs/core";
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxDemo() {
	return Div(
		{ class: "flex flex-col gap-4" },
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ id: "terms" }),
			Label(
				{ for: "terms", class: "text-sm leading-none font-medium" },
				"Accept terms and conditions",
			),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ id: "emails", checked: true }),
			Label(
				{ for: "emails", class: "text-sm leading-none font-medium" },
				"Send me product updates",
			),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ id: "partial", indeterminate: true }),
			Label(
				{ for: "partial", class: "text-sm leading-none font-medium" },
				"Select all notifications",
			),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ id: "disabled", checked: true, disabled: true }),
			Label(
				{
					for: "disabled",
					class:
						"text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				},
				"Disabled",
			),
		),
	);
}
