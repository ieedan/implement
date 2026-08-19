import { Div, Svg, type Child, type ComponentProps } from "@implementjs/core";
import {
	Accordion as AccordionPrimitive,
	AccordionContent as AccordionContentPrimitive,
	AccordionHeader as AccordionHeaderPrimitive,
	AccordionItem as AccordionItemPrimitive,
	AccordionTrigger as AccordionTriggerPrimitive,
} from "@implementjs/primitives";

const chevronDown = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

export type AccordionProps = ComponentProps<typeof AccordionPrimitive>;
export type AccordionItemProps = ComponentProps<typeof AccordionItemPrimitive>;
export type AccordionHeaderProps = ComponentProps<typeof AccordionHeaderPrimitive>;
export type AccordionTriggerProps = ComponentProps<typeof AccordionTriggerPrimitive>;
export type AccordionContentProps = ComponentProps<typeof AccordionContentPrimitive>;

export function Accordion({ class: className, ...props }: AccordionProps, ...children: Child[]) {
	return AccordionPrimitive({ "data-slot": "accordion", class: className, ...props }, ...children);
}

export function AccordionItem(
	{ class: className, ...props }: AccordionItemProps,
	...children: Child[]
) {
	return AccordionItemPrimitive(
		{
			...props,
			"data-slot": "accordion-item",
			class: ["border-b last:border-b-0", className],
		},
		...children,
	);
}

export function AccordionHeader(
	{ class: className, ...props }: AccordionHeaderProps,
	...children: Child[]
) {
	return AccordionHeaderPrimitive({ ...props, class: ["flex", className] }, ...children);
}

export function AccordionTrigger(
	{ class: className, ...props }: AccordionTriggerProps,
	...children: Child[]
) {
	return AccordionHeader(
		{ class: "flex" },
		AccordionTriggerPrimitive(
			{
				...props,
				"data-slot": "accordion-trigger",
				class: [
					"flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
					className,
				],
			},
			...children,
			Svg(chevronDown, {
				"aria-hidden": true,
				class:
					"pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 ease-in-out",
			}),
		),
	);
}

export function AccordionContent(
	{ class: className, ...props }: AccordionContentProps,
	...children: Child[]
) {
	return AccordionContentPrimitive(
		{
			...props,
			"data-slot": "accordion-content",
			class:
				"grid grid-rows-[0fr] text-sm transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none data-[state=open]:grid-rows-[1fr] [&[hidden]]:!grid",
		},
		Div({ class: ["min-h-0 overflow-hidden pt-0 pb-4", className] }, ...children),
	);
}
