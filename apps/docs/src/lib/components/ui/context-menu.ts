import { type Child, type ComponentProps } from "@implementjs/core";
import {
	ContextMenu as ContextMenuPrimitive,
	ContextMenuCheckboxGroup as ContextMenuCheckboxGroupPrimitive,
	ContextMenuCheckboxItem as ContextMenuCheckboxItemPrimitive,
	ContextMenuContent as ContextMenuContentPrimitive,
	ContextMenuGroup as ContextMenuGroupPrimitive,
	ContextMenuGroupHeading as ContextMenuGroupHeadingPrimitive,
	ContextMenuItem as ContextMenuItemPrimitive,
	ContextMenuRadioGroup as ContextMenuRadioGroupPrimitive,
	ContextMenuRadioItem as ContextMenuRadioItemPrimitive,
	ContextMenuSeparator as ContextMenuSeparatorPrimitive,
	ContextMenuSub as ContextMenuSubPrimitive,
	ContextMenuSubContent as ContextMenuSubContentPrimitive,
	ContextMenuSubTrigger as ContextMenuSubTriggerPrimitive,
	ContextMenuTrigger as ContextMenuTriggerPrimitive,
} from "@implementjs/primitives";
import {
	MenuCheckIndicator,
	MenuRadioIndicator,
	MenuSubTriggerChevron,
	menuContentClasses,
	menuGroupHeadingClasses,
	menuIndicatorItemClasses,
	menuItemClasses,
	menuSeparatorClasses,
	menuStaticPanelClasses,
	menuSubTriggerClasses,
} from "./dropdown-menu";
import { createComponent } from "@implementjs/primitives";
import { cn } from "@/lib/utils";

export type ContextMenuProps = ComponentProps<typeof ContextMenuPrimitive>;
export const ContextMenu = ContextMenuPrimitive;

export type ContextMenuTriggerProps = ComponentProps<typeof ContextMenuTriggerPrimitive>;
export const ContextMenuTrigger = ContextMenuTriggerPrimitive;

export type ContextMenuContentProps = ComponentProps<typeof ContextMenuContentPrimitive>;

export const ContextMenuContent = createComponent(function ContextMenuContent(
	{ class: className, ...props }: ContextMenuContentProps,
	...children: Child[]
) {
	return ContextMenuContentPrimitive(
		{
			...props,
			"data-slot": "context-menu-content",
			class: cn(
				menuContentClasses,
				"origin-(--ip-context-menu-content-transform-origin)",
				className,
			),
		},
		...children,
	);
});

export type ContextMenuItemProps = ComponentProps<typeof ContextMenuItemPrimitive>;

export const ContextMenuItem = createComponent(function ContextMenuItem(
	{ class: className, ...props }: ContextMenuItemProps,
	...children: Child[]
) {
	return ContextMenuItemPrimitive(
		{ ...props, "data-slot": "context-menu-item", class: cn(menuItemClasses, className) },
		...children,
	);
});

export type ContextMenuCheckboxGroupProps = ComponentProps<
	typeof ContextMenuCheckboxGroupPrimitive
>;
export const ContextMenuCheckboxGroup = ContextMenuCheckboxGroupPrimitive;

export type ContextMenuCheckboxItemProps = ComponentProps<typeof ContextMenuCheckboxItemPrimitive>;

export const ContextMenuCheckboxItem = createComponent(function ContextMenuCheckboxItem(
	{ class: className, ...props }: ContextMenuCheckboxItemProps,
	...children: Child[]
) {
	return ContextMenuCheckboxItemPrimitive(
		{
			...props,
			"data-slot": "context-menu-checkbox-item",
			class: cn("group/menu-item", menuItemClasses, menuIndicatorItemClasses, className),
		},
		MenuCheckIndicator(),
		...children,
	);
});

export type ContextMenuRadioGroupProps = ComponentProps<typeof ContextMenuRadioGroupPrimitive>;
export const ContextMenuRadioGroup = ContextMenuRadioGroupPrimitive;

export type ContextMenuRadioItemProps = ComponentProps<typeof ContextMenuRadioItemPrimitive>;

export const ContextMenuRadioItem = createComponent(function ContextMenuRadioItem(
	{ class: className, ...props }: ContextMenuRadioItemProps,
	...children: Child[]
) {
	return ContextMenuRadioItemPrimitive(
		{
			...props,
			"data-slot": "context-menu-radio-item",
			class: cn("group/menu-item", menuItemClasses, menuIndicatorItemClasses, className),
		},
		MenuRadioIndicator(),
		...children,
	);
});

export type ContextMenuGroupProps = ComponentProps<typeof ContextMenuGroupPrimitive>;
export const ContextMenuGroup = ContextMenuGroupPrimitive;

export type ContextMenuGroupHeadingProps = ComponentProps<typeof ContextMenuGroupHeadingPrimitive>;

export const ContextMenuGroupHeading = createComponent(function ContextMenuGroupHeading(
	{ class: className, ...props }: ContextMenuGroupHeadingProps,
	...children: Child[]
) {
	return ContextMenuGroupHeadingPrimitive(
		{
			...props,
			"data-slot": "context-menu-group-heading",
			class: cn(menuGroupHeadingClasses, className),
		},
		...children,
	);
});

export type ContextMenuSeparatorProps = ComponentProps<typeof ContextMenuSeparatorPrimitive>;

export const ContextMenuSeparator = createComponent(function ContextMenuSeparator({
	class: className,
	...props
}: ContextMenuSeparatorProps) {
	return ContextMenuSeparatorPrimitive({
		...props,
		"data-slot": "context-menu-separator",
		class: cn(menuSeparatorClasses, className),
	});
});

export type ContextMenuSubProps = ComponentProps<typeof ContextMenuSubPrimitive>;
export const ContextMenuSub = ContextMenuSubPrimitive;

export type ContextMenuSubTriggerProps = ComponentProps<typeof ContextMenuSubTriggerPrimitive>;

export const ContextMenuSubTrigger = createComponent(function ContextMenuSubTrigger(
	{ class: className, ...props }: ContextMenuSubTriggerProps,
	...children: Child[]
) {
	return ContextMenuSubTriggerPrimitive(
		{
			...props,
			"data-slot": "context-menu-sub-trigger",
			class: cn(menuItemClasses, menuSubTriggerClasses, className),
		},
		...children,
		MenuSubTriggerChevron(),
	);
});

export type ContextMenuSubContentProps = ComponentProps<typeof ContextMenuSubContentPrimitive>;

export const ContextMenuSubContent = createComponent(function ContextMenuSubContent(
	{ class: className, offset = 8, ...props }: ContextMenuSubContentProps,
	...children: Child[]
) {
	return ContextMenuSubContentPrimitive(
		{
			offset,
			...props,
			"data-slot": "context-menu-sub-content",
			class: cn(menuStaticPanelClasses, className),
		},
		...children,
	);
});
