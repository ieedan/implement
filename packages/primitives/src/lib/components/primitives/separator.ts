import { Div, type Child } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type SeparatorProps = RenderableProps<typeof Div> & {
	orientation?: "horizontal" | "vertical";
	/** Purely visual separators are hidden from the accessibility tree. */
	decorative?: boolean;
};

export const Separator = createComponent(function Separator(
	{
		id = getId(),
		orientation = "horizontal",
		decorative = false,
		render = Div,
		...restProps
	}: SeparatorProps,
	...children: Child[]
) {
	return render(
		mergeProps(
			{
				id,
				"data-separator-root": "",
				"data-orientation": orientation,
				role: decorative ? "none" : "separator",
				// aria-orientation defaults to horizontal on role="separator"
				"aria-orientation": !decorative && orientation === "vertical" ? "vertical" : undefined,
				"aria-hidden": decorative ? true : undefined,
			},
			restProps,
		),
		...children,
	);
});
