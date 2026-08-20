import { Div, Label } from "@implementjs/core";
import { Switch } from "@/lib/components/ui/switch";

export default function SwitchDemo() {
	return Div(
		{ class: "flex flex-col gap-4" },
		Div(
			{ class: "flex items-center gap-2" },
			Switch({ id: "airplane" }),
			Label({ for: "airplane", class: "text-sm leading-none font-medium" }, "Airplane mode"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Switch({ id: "marketing", checked: true }),
			Label({ for: "marketing", class: "text-sm leading-none font-medium" }, "Marketing emails"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Switch({ id: "disabled-switch", checked: true, disabled: true }),
			Label(
				{
					for: "disabled-switch",
					class:
						"text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				},
				"Disabled",
			),
		),
	);
}
