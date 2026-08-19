import { Div, type Child, type ComponentProps } from "@implementjs/core";
import { mergeProps } from "../../merge-props";

export type SeparatorProps = ComponentProps<typeof Div> & {
	orientation?: "horizontal" | "vertical";
	/** Purely visual separators are hidden from the accessibility tree. */
	decorative?: boolean;
};

export function Separator(
	{ orientation = "horizontal", decorative = false, ...restProps }: SeparatorProps,
	...children: Child[]
) {
	return Div(
		mergeProps(
			{
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
}
