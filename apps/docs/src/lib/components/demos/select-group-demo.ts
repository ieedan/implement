import { Div, P, signal } from "@implementjs/core";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectGroupHeading,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/lib/components/ui/select";

const citrus = [
	{ value: "orange", label: "Orange" },
	{ value: "lemon", label: "Lemon" },
	{ value: "lime", label: "Lime" },
];

const berries = [
	{ value: "blueberry", label: "Blueberry" },
	{ value: "strawberry", label: "Strawberry" },
	{ value: "grapes", label: "Grapes" },
];

const tropical = [
	{ value: "pineapple", label: "Pineapple" },
	{ value: "mango", label: "Mango" },
];

const fruits = [...citrus, ...berries, ...tropical];

export default function SelectGroupDemo() {
	const value = signal<string | null>(null);

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		Select(
			{ value, items: fruits },
			SelectTrigger(
				{ class: "w-48 min-w-48 max-w-48" },
				SelectValue({
					placeholder: "Select a fruit",
				}),
			),
			SelectContent(
				{},
				SelectGroup(
					{},
					SelectGroupHeading({}, "Citrus"),
					...citrus.map((fruit) => SelectItem({ value: fruit.value }, fruit.label)),
				),
				SelectGroup(
					{},
					SelectGroupHeading({}, "Berries"),
					...berries.map((fruit) => SelectItem({ value: fruit.value }, fruit.label)),
				),
				SelectGroup(
					{},
					SelectGroupHeading({}, "Tropical"),
					...tropical.map((fruit) => SelectItem({ value: fruit.value }, fruit.label)),
				),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			value.bind((selected) => (selected == null ? "No fruit selected" : `Selected: ${selected}`)),
		),
	);
}
