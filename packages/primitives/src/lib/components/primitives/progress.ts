import {
	derived,
	Div,
	signal,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

export type ProgressProps = ComponentProps<typeof Div> & {
	/** The current value. Pass `null` for an indeterminate progress bar. */
	value?: Signal<number | null> | number | null;
	min?: Signal<number> | number;
	max?: Signal<number> | number;
};

/**
 * Completion status of a task, like a file upload. Renders a `Div` with
 * `role="progressbar"` and the aria value attributes; give it an accessible
 * name with `aria-label` or `aria-labelledby`. A `null` value means the
 * duration is unknown and renders an indeterminate bar. For a measurement
 * that can move in either direction, use a meter instead.
 */
export const Progress = createComponent(function Progress(
	{ id = getId(), value = 0, min = 0, max = 100, ...restProps }: ProgressProps,
	...children: Child[]
) {
	const valueSignal = signal(value);
	const minSignal = signal(min);
	const maxSignal = signal(max);

	const state = derived([valueSignal, maxSignal], (value, max) => {
		if (value === null) return "indeterminate";
		return value === max ? "loaded" : "loading";
	});

	return Div(
		mergeProps(
			{
				id,
				role: "progressbar",
				"aria-valuemin": minSignal,
				"aria-valuemax": maxSignal,
				"aria-valuenow": valueSignal.bind((value) => value ?? undefined),
				"data-progress-root": "",
				"data-state": state,
				"data-value": valueSignal.bind((value) => value ?? undefined),
				"data-min": minSignal,
				"data-max": maxSignal,
				"data-indeterminate": valueSignal.bind((value) => (value === null ? "" : undefined)),
			},
			restProps,
		),
		...children,
	);
});
