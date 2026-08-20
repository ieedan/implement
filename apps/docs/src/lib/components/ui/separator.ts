import type { ComponentProps } from "@implementjs/core";
import { Separator as SeparatorPrimitive } from "@implementjs/primitives";

export type SeparatorProps = ComponentProps<typeof SeparatorPrimitive>;

export function Separator({
	class: className,
	orientation = "horizontal",
	decorative = true,
	...props
}: SeparatorProps) {
	return SeparatorPrimitive({
		...props,
		orientation,
		decorative,
		"data-slot": "separator",
		class: [
			"shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
			className,
		],
	});
}
