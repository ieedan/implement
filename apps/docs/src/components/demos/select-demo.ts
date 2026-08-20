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
	const open = signal(false);
	const value = signal<string | null>(null);

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		Select(
			{ open, value },
			SelectTrigger(
				{ class: "w-48 min-w-48 max-w-48" },
				SelectValue({
					render: (props) => {
						if (props.type === "single") {
							return props.value.bind(
								(v) => fruits.find((fruit) => fruit.value === v)?.label ?? "Select a fruit",
							);
						}
						return props.value.bind((v) => v.join(", "));
					},
				}),
			),
			SelectContent(
				{ hidden: open.bind((isOpen) => (isOpen ? undefined : true)) },
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
