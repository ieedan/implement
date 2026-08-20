import { Div, P, signal } from "@implementjs/core";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const toppings = [
	{ value: "pepperoni", label: "Pepperoni" },
	{ value: "mushrooms", label: "Mushrooms" },
	{ value: "onions", label: "Onions" },
	{ value: "sausage", label: "Sausage" },
	{ value: "olives", label: "Olives" },
];

export default function SelectMultipleDemo() {
	const value = signal<string[]>([]);

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		Select(
			{ type: "multiple", value },
			SelectTrigger(
				{ class: "h-9 w-56 min-w-56 max-w-56" },
				SelectValue({
					placeholder: "Select toppings",
					label: (id) => toppings.find((topping) => topping.value === id)?.label ?? id,
				}),
			),
			SelectContent(
				{},
				...toppings.map((topping) => SelectItem({ value: topping.value }, topping.label)),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			value.bind((selected) => (selected.length === 0 ? "Nothing selected" : selected.join(", "))),
		),
	);
}
