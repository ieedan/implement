import { derived, Div, type Child, type Readable } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type ProgressProps = RenderableProps<typeof Div> & {
	/** The current value. Pass `null` for an indeterminate progress bar. */
	value?: Readable<number | null> | number | null;
	min?: Readable<number> | number;
	max?: Readable<number> | number;
};

/**
 * Completion status of a task, like a file upload. Renders a `Div` with
 * `role="progressbar"` and the aria value attributes; give it an accessible
 * name with `aria-label` or `aria-labelledby`. A `null` value means the
 * duration is unknown and renders an indeterminate bar. For a measurement
 * that can move in either direction, use a meter instead.
 */
export const Progress = createComponent(function Progress(
	{ id = getId(), value = 0, min = 0, max = 100, render = Div, ...restProps }: ProgressProps,
	...children: Child[]
) {
	const currentValue = toReadable(value);
	const minValue = toReadable(min);
	const maxValue = toReadable(max);

	const state = derived([currentValue, maxValue], (value, max) => {
		if (value === null) return "indeterminate";
		return value === max ? "loaded" : "loading";
	});

	return render(
		mergeProps(
			{
				id,
				role: "progressbar",
				"aria-valuemin": minValue,
				"aria-valuemax": maxValue,
				"aria-valuenow": currentValue.bind((value) => value ?? undefined),
				"data-progress-root": "",
				"data-state": state,
				"data-value": currentValue.bind((value) => value ?? undefined),
				"data-min": minValue,
				"data-max": maxValue,
				"data-indeterminate": currentValue.bind((value) => (value === null ? "" : undefined)),
			},
			restProps,
		),
		...children,
	);
});
