import { Div, Label } from "@implementjs/core";
import { RadioGroup, RadioGroupItem } from "@/lib/components/ui/radio-group";

function Option(value: string, label: string) {
	return Div(
		{ class: "flex items-center gap-2" },
		RadioGroupItem({ id: value, value }),
		Label({ for: value, class: "text-sm leading-none font-medium" }, label),
	);
}

export default function RadioGroupDemo() {
	return RadioGroup(
		{ value: "comfortable", "aria-label": "Density" },
		Option("default", "Default"),
		Option("comfortable", "Comfortable"),
		Option("compact", "Compact"),
	);
}
