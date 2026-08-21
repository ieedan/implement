import { Div, signal, type Child, type ComponentProps, type Signal } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

export type MeterProps = ComponentProps<typeof Div> & {
	value?: Signal<number> | number;
	min?: Signal<number> | number;
	max?: Signal<number> | number;
};

/**
 * A static measurement within a known range, like CPU usage or a token quota.
 * Renders a `Div` with `role="meter"` and the aria value attributes; give it
 * an accessible name with `aria-label` or `aria-labelledby`. For task
 * completion, use a progress bar instead.
 */
export const Meter = createComponent(function Meter(
	{ id = getId(), value = 0, min = 0, max = 100, ...restProps }: MeterProps,
	...children: Child[]
) {
	const valueSignal = signal(value);
	const minSignal = signal(min);
	const maxSignal = signal(max);

	return Div(
		mergeProps(
			{
				id,
				role: "meter",
				"aria-valuemin": minSignal,
				"aria-valuemax": maxSignal,
				"aria-valuenow": valueSignal,
				"data-meter-root": "",
				"data-value": valueSignal,
				"data-min": minSignal,
				"data-max": maxSignal,
			},
			restProps,
		),
		...children,
	);
});
