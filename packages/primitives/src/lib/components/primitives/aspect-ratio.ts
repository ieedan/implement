import { Div, signal, type Child, type ComponentProps, type Signal } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type AspectRatioProps = ComponentProps<typeof Div> & {
	/** Width divided by height, e.g. `16 / 9`. */
	ratio?: Signal<number> | number;
};

/**
 * Constrains content to a width / height ratio, like a video or image frame.
 * Renders a sized wrapper `Div` around the root `Div` your props and children
 * land on; the wrapper reserves the ratio with padding, so give the parent a
 * width and the height follows.
 */
export function AspectRatio(
	{ id = getId(), ratio = 1, ...restProps }: AspectRatioProps,
	...children: Child[]
) {
	const ratioSignal = signal(ratio);

	return Div(
		{
			style: {
				position: "relative",
				width: "100%",
				paddingBottom: ratioSignal.bind((ratio) => `${ratio ? 100 / ratio : 0}%`),
			},
		},
		Div(
			mergeProps(
				{
					id,
					"data-aspect-ratio-root": "",
					style: { position: "absolute", top: "0", right: "0", bottom: "0", left: "0" },
				},
				restProps,
			),
			...children,
		),
	);
}
