import { Div, Span, type Child, type ComponentProps } from "@implementjs/core";
import { CheckIcon, ChevronDownIcon } from "@implementjs/lucide";
import {
	Select as SelectPrimitive,
	SelectContent as SelectContentPrimitive,
	SelectItem as SelectItemPrimitive,
	SelectTrigger as SelectTriggerPrimitive,
	SelectValue as SelectValuePrimitive,
} from "@implementjs/primitives";

export type SelectProps = ComponentProps<typeof SelectPrimitive>;
export type SelectTriggerProps = ComponentProps<typeof SelectTriggerPrimitive>;
export type SelectContentProps = ComponentProps<typeof SelectContentPrimitive>;
export type SelectItemProps = ComponentProps<typeof SelectItemPrimitive>;

export const SelectValue = SelectValuePrimitive;

export function Select(props: SelectProps, ...children: Child[]) {
	return SelectPrimitive(props, Div({ class: "relative" }, ...children));
}

export function SelectTrigger(
	{ class: className, type = "button", ...props }: SelectTriggerProps,
	...children: Child[]
) {
	return SelectTriggerPrimitive(
		{
			type,
			...props,
			"data-slot": "select-trigger",
			class: [
				"flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			],
		},
		...children,
		ChevronDownIcon({
			"aria-hidden": true,
			class: "size-4 shrink-0 opacity-50",
		}),
	);
}

export function SelectContent(
	{ offset = 4, side = "bottom", align = "start", class: className, ...props }: SelectContentProps,
	...children: Child[]
) {
	return SelectContentPrimitive(
		{
			...props,
			offset,
			side,
			align,
			"data-slot": "select-content",
			class: [
				"absolute top-full left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
				"w-[var(--ip-select-anchor-width,100%)] min-w-32 origin-(--ip-select-content-transform-origin)",
				"max-h-(--ip-select-content-available-height)",
				className,
			],
		},
		...children,
	);
}

export function SelectItem({ class: className, ...props }: SelectItemProps, ...children: Child[]) {
	return SelectItemPrimitive(
		{
			...props,
			"data-slot": "select-item",
			class: [
				"group/select-item relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none",
				"data-selected:bg-accent/50",
				"data-highlighted:bg-accent data-highlighted:text-accent-foreground",
				"data-selected:data-highlighted:bg-accent",
				"data-disabled:pointer-events-none data-disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			],
		},
		Span({ class: "flex-1 truncate" }, ...children),
		Span(
			{
				class: "absolute right-2 flex size-3.5 items-center justify-center",
			},
			CheckIcon({
				"aria-hidden": true,
				class: "size-4 opacity-0 group-data-selected/select-item:opacity-100",
			}),
		),
	);
}
