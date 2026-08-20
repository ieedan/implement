import { Div, P, signal } from "@implementjs/core";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const fruits = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes", disabled: true },
	{ value: "pineapple", label: "Pineapple" },
];

export default function SelectDemo() {
	const value = signal<string | null>(null);

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		Select(
			{ value },
			SelectTrigger(
				{ class: "w-48 min-w-48 max-w-48" },
				SelectValue({
					placeholder: "Select a fruit",
					label: (id) => fruits.find((fruit) => fruit.value === id)?.label ?? id,
				}),
			),
			SelectContent(
				{},
				...fruits.map((fruit) =>
					SelectItem({ value: fruit.value, disabled: fruit.disabled }, fruit.label),
				),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			value.bind((selected) => (selected == null ? "No fruit selected" : `Selected: ${selected}`)),
		),
	);
}
