import { Div, ForEach, If, P, Span, signal } from "@implementjs/core";
import { XIcon } from "@implementjs/lucide";
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

function toppingLabel(id: string) {
	return toppings.find((topping) => topping.value === id)?.label ?? id;
}

export default function SelectMultipleDemo() {
	const open = signal(false);
	const value = signal<string[]>([]);

	function removeTopping(event: Event, id: string) {
		event.preventDefault();
		event.stopPropagation();
		const index = value.get().indexOf(id);
		if (index !== -1) value.splice(index, 1);
	}

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		Select(
			{ type: "multiple", open, value },
			SelectTrigger(
				{ class: "h-9 w-56 min-w-56 max-w-56" },
				SelectValue({
					render: (props) => {
						if (props.type !== "multiple") {
							return props.value.bind((v) => v ?? "");
						}

						return Div(
							{
								class:
									"flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
							},
							If(props.value.bind((selected) => selected.length === 0)).Then(
								Span({ class: "text-muted-foreground" }, "Select toppings"),
							),
							ForEach(
								props.value,
								(id) => id,
								(id) =>
									Span(
										{
											class:
												"inline-flex shrink-0 items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium",
										},
										Span({ class: "truncate" }, id.bind(toppingLabel)),
										Span(
											{
												role: "button",
												tabIndex: -1,
												"aria-label": id.bind((current) => `Remove ${toppingLabel(current)}`),
												class:
													"flex size-3.5 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10",
												onPointerdown: (event) => event.stopPropagation(),
												onClick: (event) => removeTopping(event, id.get()),
											},
											XIcon({ class: "size-3", "aria-hidden": true }),
										),
									),
							),
						);
					},
				}),
			),
			SelectContent(
				{ hidden: open.bind((isOpen) => (isOpen ? undefined : true)) },
				...toppings.map((topping) => SelectItem({ value: topping.value }, topping.label)),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			value.bind((selected) => (selected.length === 0 ? "Nothing selected" : selected.join(", "))),
		),
	);
}
