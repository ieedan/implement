import { Div, Span } from "@implementjs/core";
import { Meter } from "@/lib/components/ui/meter";

export default function MeterDemo() {
	const value = 3000;
	const max = 4000;

	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-2" },
		Div(
			{ class: "flex items-center justify-between text-sm font-medium" },
			Span({ id: "tokens-label" }, "Tokens used"),
			Span({ class: "tabular-nums" }, `${value} / ${max}`),
		),
		Meter({
			"aria-labelledby": "tokens-label",
			"aria-valuetext": `${value} of ${max} tokens used`,
			value,
			max,
		}),
	);
}
