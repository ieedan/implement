import { Div, type Child, type Readable } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type MeterProps = RenderableProps<typeof Div> & {
	value?: Readable<number> | number;
	min?: Readable<number> | number;
	max?: Readable<number> | number;
};

/**
 * A static measurement within a known range, like CPU usage or a token quota.
 * Renders a `Div` with `role="meter"` and the aria value attributes; give it
 * an accessible name with `aria-label` or `aria-labelledby`. For task
 * completion, use a progress bar instead.
 */
export const Meter = createComponent(function Meter(
	{ id = getId(), value = 0, min = 0, max = 100, render = Div, ...restProps }: MeterProps,
	...children: Child[]
) {
	const currentValue = toReadable(value);
	const minValue = toReadable(min);
	const maxValue = toReadable(max);

	return render(
		mergeProps(
			{
				id,
				role: "meter",
				"aria-valuemin": minValue,
				"aria-valuemax": maxValue,
				"aria-valuenow": currentValue,
				"data-meter-root": "",
				"data-value": currentValue,
				"data-min": minValue,
				"data-max": maxValue,
			},
			restProps,
		),
		...children,
	);
});
