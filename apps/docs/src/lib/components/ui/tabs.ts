import { type Child, type ComponentProps } from "@implementjs/core";
import {
	Tabs as TabsPrimitive,
	TabsContent as TabsContentPrimitive,
	TabsList as TabsListPrimitive,
	TabsTrigger as TabsTriggerPrimitive,
} from "@implementjs/primitives";
import { createComponent } from "@implementjs/primitives";

export type TabsProps = ComponentProps<typeof TabsPrimitive>;
export type TabsListProps = ComponentProps<typeof TabsListPrimitive>;
export type TabsTriggerProps = ComponentProps<typeof TabsTriggerPrimitive>;
export type TabsContentProps = ComponentProps<typeof TabsContentPrimitive>;

export const Tabs = createComponent(function Tabs({ class: className, ...props }: TabsProps, ...children: Child[]) {
	return TabsPrimitive(
		{
			...props,
			"data-slot": "tabs",
			class: ["flex flex-col gap-2 data-[orientation=vertical]:flex-row", className],
		},
		...children,
	);
});

export const TabsList = createComponent(function TabsList({ class: className, ...props }: TabsListProps, ...children: Child[]) {
	return TabsListPrimitive(
		{
			...props,
			"data-slot": "tabs-list",
			class: [
				"inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
				"data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
				className,
			],
		},
		...children,
	);
});

export const TabsTrigger = createComponent(function TabsTrigger(
	{ class: className, ...props }: TabsTriggerProps,
	...children: Child[]
) {
	return TabsTriggerPrimitive(
		{
			...props,
			"data-slot": "tabs-trigger",
			class: [
				"inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] outline-none",
				"hover:text-foreground",
				"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				"disabled:pointer-events-none disabled:opacity-50",
				// shadcn's dark recipe (bg-input/30 on a bg-muted track) has no
				// contrast in this theme, where --input and --muted are both
				// #222 — so the selected tab lifts off the track instead
				"data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
				"data-[orientation=vertical]:h-auto data-[orientation=vertical]:justify-start",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			],
		},
		...children,
	);
});

export const TabsContent = createComponent(function TabsContent(
	{ class: className, ...props }: TabsContentProps,
	...children: Child[]
) {
	return TabsContentPrimitive(
		{
			...props,
			"data-slot": "tabs-content",
			class: [
				"flex-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			],
		},
		...children,
	);
});
