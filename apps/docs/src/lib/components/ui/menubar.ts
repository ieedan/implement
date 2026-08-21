import { type Child, type ComponentProps } from "@implementjs/core";
import {
	Menubar as MenubarPrimitive,
	MenubarCheckboxItem as MenubarCheckboxItemPrimitive,
	MenubarContent as MenubarContentPrimitive,
	MenubarGroup as MenubarGroupPrimitive,
	MenubarGroupHeading as MenubarGroupHeadingPrimitive,
	MenubarItem as MenubarItemPrimitive,
	MenubarMenu as MenubarMenuPrimitive,
	MenubarRadioGroup as MenubarRadioGroupPrimitive,
	MenubarRadioItem as MenubarRadioItemPrimitive,
	MenubarSeparator as MenubarSeparatorPrimitive,
	MenubarSub as MenubarSubPrimitive,
	MenubarSubContent as MenubarSubContentPrimitive,
	MenubarSubTrigger as MenubarSubTriggerPrimitive,
	MenubarTrigger as MenubarTriggerPrimitive,
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

export type MenubarProps = ComponentProps<typeof MenubarPrimitive>;

export const Menubar = createComponent(function Menubar({ class: className, ...props }: MenubarProps, ...children: Child[]) {
	return MenubarPrimitive(
		{
			...props,
			"data-slot": "menubar",
			class: [
				"flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
				className,
			],
		},
		...children,
	);
});

export type MenubarMenuProps = ComponentProps<typeof MenubarMenuPrimitive>;
export const MenubarMenu = MenubarMenuPrimitive;

export type MenubarTriggerProps = ComponentProps<typeof MenubarTriggerPrimitive>;

export const MenubarTrigger = createComponent(function MenubarTrigger(
	{ class: className, ...props }: MenubarTriggerProps,
	...children: Child[]
) {
	return MenubarTriggerPrimitive(
		{
			...props,
			"data-slot": "menubar-trigger",
			class: [
				"flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-none select-none",
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
				"data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
				className,
			],
		},
		...children,
	);
});

export type MenubarContentProps = ComponentProps<typeof MenubarContentPrimitive>;

export const MenubarContent = createComponent(function MenubarContent(
	{ class: className, offset = 8, ...props }: MenubarContentProps,
	...children: Child[]
) {
	return MenubarContentPrimitive(
		{
			offset,
			...props,
			"data-slot": "menubar-content",
			class: [menuContentClasses, "origin-(--ip-menubar-content-transform-origin)", className],
		},
		...children,
	);
});

export type MenubarItemProps = ComponentProps<typeof MenubarItemPrimitive>;

export const MenubarItem = createComponent(function MenubarItem(
	{ class: className, ...props }: MenubarItemProps,
	...children: Child[]
) {
	return MenubarItemPrimitive(
		{ ...props, "data-slot": "menubar-item", class: [menuItemClasses, className] },
		...children,
	);
});

export type MenubarCheckboxItemProps = ComponentProps<typeof MenubarCheckboxItemPrimitive>;

export const MenubarCheckboxItem = createComponent(function MenubarCheckboxItem(
	{ class: className, ...props }: MenubarCheckboxItemProps,
	...children: Child[]
) {
	return MenubarCheckboxItemPrimitive(
		{
			...props,
			"data-slot": "menubar-checkbox-item",
			class: ["group/menu-item", menuItemClasses, menuIndicatorItemClasses, className],
		},
		MenuCheckIndicator(),
		...children,
	);
});

export type MenubarRadioGroupProps = ComponentProps<typeof MenubarRadioGroupPrimitive>;
export const MenubarRadioGroup = MenubarRadioGroupPrimitive;

export type MenubarRadioItemProps = ComponentProps<typeof MenubarRadioItemPrimitive>;

export const MenubarRadioItem = createComponent(function MenubarRadioItem(
	{ class: className, ...props }: MenubarRadioItemProps,
	...children: Child[]
) {
	return MenubarRadioItemPrimitive(
		{
			...props,
			"data-slot": "menubar-radio-item",
			class: ["group/menu-item", menuItemClasses, menuIndicatorItemClasses, className],
		},
		MenuRadioIndicator(),
		...children,
	);
});

export type MenubarGroupProps = ComponentProps<typeof MenubarGroupPrimitive>;
export const MenubarGroup = MenubarGroupPrimitive;

export type MenubarGroupHeadingProps = ComponentProps<typeof MenubarGroupHeadingPrimitive>;

export const MenubarGroupHeading = createComponent(function MenubarGroupHeading(
	{ class: className, ...props }: MenubarGroupHeadingProps,
	...children: Child[]
) {
	return MenubarGroupHeadingPrimitive(
		{ ...props, "data-slot": "menubar-group-heading", class: [menuGroupHeadingClasses, className] },
		...children,
	);
});

export type MenubarSeparatorProps = ComponentProps<typeof MenubarSeparatorPrimitive>;

export const MenubarSeparator = createComponent(function MenubarSeparator({ class: className, ...props }: MenubarSeparatorProps) {
	return MenubarSeparatorPrimitive({
		...props,
		"data-slot": "menubar-separator",
		class: [menuSeparatorClasses, className],
	});
});

export type MenubarSubProps = ComponentProps<typeof MenubarSubPrimitive>;
export const MenubarSub = MenubarSubPrimitive;

export type MenubarSubTriggerProps = ComponentProps<typeof MenubarSubTriggerPrimitive>;

export const MenubarSubTrigger = createComponent(function MenubarSubTrigger(
	{ class: className, ...props }: MenubarSubTriggerProps,
	...children: Child[]
) {
	return MenubarSubTriggerPrimitive(
		{
			...props,
			"data-slot": "menubar-sub-trigger",
			class: [menuItemClasses, menuSubTriggerClasses, className],
		},
		...children,
		MenuSubTriggerChevron(),
	);
});

export type MenubarSubContentProps = ComponentProps<typeof MenubarSubContentPrimitive>;

export const MenubarSubContent = createComponent(function MenubarSubContent(
	{ class: className, offset = 8, ...props }: MenubarSubContentProps,
	...children: Child[]
) {
	return MenubarSubContentPrimitive(
		{
			offset,
			...props,
			"data-slot": "menubar-sub-content",
			class: [menuStaticPanelClasses, className],
		},
		...children,
	);
});
