import { Div, type Child, type Readable } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type AspectRatioProps = RenderableProps<typeof Div> & {
	/** Width divided by height, e.g. `16 / 9`. */
	ratio?: Readable<number> | number;
};

/**
 * Constrains content to a width / height ratio, like a video or image frame.
 * Renders a sized wrapper `Div` around the root `Div` your props and children
 * land on; the wrapper reserves the ratio with padding, so give the parent a
 * width and the height follows.
 */
export const AspectRatio = createComponent(function AspectRatio(
	{ id = getId(), ratio = 1, render = Div, ...restProps }: AspectRatioProps,
	...children: Child[]
) {
	const currentRatio = toReadable(ratio);

	return Div(
		{
			style: {
				position: "relative",
				width: "100%",
				paddingBottom: currentRatio.bind((ratio) => `${ratio ? 100 / ratio : 0}%`),
			},
		},
		render(
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
});
