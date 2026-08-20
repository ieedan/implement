import { Div, type Child, type ComponentProps } from "@implementjs/core";
import {
	Collapsible as CollapsiblePrimitive,
	CollapsibleContent as CollapsibleContentPrimitive,
	CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@implementjs/primitives";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button";

export type CollapsibleProps = ComponentProps<typeof CollapsiblePrimitive>;
export type CollapsibleTriggerProps = ComponentProps<typeof CollapsibleTriggerPrimitive> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};
export type CollapsibleContentProps = ComponentProps<typeof CollapsibleContentPrimitive>;

export function Collapsible(
	{ class: className, ...props }: CollapsibleProps,
	...children: Child[]
) {
	return CollapsiblePrimitive(
		{ "data-slot": "collapsible", class: ["flex flex-col gap-2", className], ...props },
		...children,
	);
}

export function CollapsibleTrigger(
	{
		class: className,
		variant = "ghost",
		size = "default",
		type = "button",
		...props
	}: CollapsibleTriggerProps,
	...children: Child[]
) {
	return CollapsibleTriggerPrimitive(
		{
			type,
			...props,
			"data-slot": "collapsible-trigger",
			"data-variant": variant,
			"data-size": size,
			class: [buttonVariants({ variant, size }), className],
		},
		...children,
	);
}

export function CollapsibleContent(
	{ class: className, ...props }: CollapsibleContentProps,
	...children: Child[]
) {
	return CollapsibleContentPrimitive(
		{
			...props,
			"data-slot": "collapsible-content",
			class:
				"grid grid-rows-[0fr] text-sm transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none data-[state=open]:grid-rows-[1fr] [&[hidden]]:!grid",
		},
		Div({ class: ["min-h-0 overflow-hidden", className] }, ...children),
	);
}
