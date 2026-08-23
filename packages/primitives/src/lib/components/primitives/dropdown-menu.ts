import {
	Button,
	Portal,
	signal,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import {
	MenuCheckboxGroup,
	MenuCheckboxItem,
	MenuContent,
	MenuCtx,
	MenuGroup,
	MenuGroupHeading,
	MenuItem,
	MenuRadioGroup,
	MenuRadioItem,
	MenuRoot,
	MenuSeparator,
	MenuState,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	menuTriggerProps,
	type MenuCheckboxGroupProps,
	type MenuCheckboxItemProps,
	type MenuContentProps,
	type MenuGroupHeadingProps,
	type MenuGroupProps,
	type MenuItemProps,
	type MenuRadioGroupProps,
	type MenuRadioItemProps,
	type MenuRootOptions,
	type MenuSeparatorProps,
	type MenuSubContentProps,
	type MenuSubProps,
	type MenuSubTriggerProps,
} from "./menu";
import { createComponent } from "../../create-component";

export type DropdownMenuRootProps = MenuRootOptions;

/**
 * A menu of actions opened from a trigger button. Built on the shared menu
 * base; see ContextMenu and Menubar for the other flavors.
 */
export const DropdownMenu = createComponent(function DropdownMenu(
	props: DropdownMenuRootProps,
	...children: Child[]
) {
	const state = new MenuState("dropdown-menu", props);
	return MenuRoot(state, ...children);
});

export type DropdownMenuTriggerProps = Omit<ComponentProps<typeof Button>, "disabled"> & {
	disabled?: Signal<boolean> | boolean;
};

export const DropdownMenuTrigger = createComponent(function DropdownMenuTrigger(
	{ id = getId(), disabled = false, ...restProps }: DropdownMenuTriggerProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		const disabledSignal = signal(disabled);
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					...menuTriggerProps(state, { disabled: disabledSignal }),
					onClick: () => {
						if (disabledSignal.get()) return;
						state.toggleOpen(false);
					},
					onKeydown: (e: KeyboardEvent) => {
						if (disabledSignal.get()) return;
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							state.toggleOpen(true);
						} else if (e.key === "ArrowDown") {
							e.preventDefault();
							state.openMenu(true);
						}
					},
				},
				restProps,
			),
			...children,
		);
	});
});

export type DropdownMenuContentProps = MenuContentProps;
export const DropdownMenuContent = MenuContent;

export type DropdownMenuItemProps = MenuItemProps;
export const DropdownMenuItem = MenuItem;

export type DropdownMenuCheckboxGroupProps = MenuCheckboxGroupProps;
export const DropdownMenuCheckboxGroup = MenuCheckboxGroup;

export type DropdownMenuCheckboxItemProps = MenuCheckboxItemProps;
export const DropdownMenuCheckboxItem = MenuCheckboxItem;

export type DropdownMenuRadioGroupProps = MenuRadioGroupProps;
export const DropdownMenuRadioGroup = MenuRadioGroup;

export type DropdownMenuRadioItemProps = MenuRadioItemProps;
export const DropdownMenuRadioItem = MenuRadioItem;

export type DropdownMenuGroupProps = MenuGroupProps;
export const DropdownMenuGroup = MenuGroup;

export type DropdownMenuGroupHeadingProps = MenuGroupHeadingProps;
export const DropdownMenuGroupHeading = MenuGroupHeading;

export type DropdownMenuSeparatorProps = MenuSeparatorProps;
export const DropdownMenuSeparator = MenuSeparator;

export type DropdownMenuSubProps = MenuSubProps;
export const DropdownMenuSub = MenuSub;

export type DropdownMenuSubTriggerProps = MenuSubTriggerProps;
export const DropdownMenuSubTrigger = MenuSubTrigger;

export type DropdownMenuSubContentProps = MenuSubContentProps;
export const DropdownMenuSubContent = MenuSubContent;

export type DropdownMenuPortalProps = PortalProps;
export const DropdownMenuPortal = Portal;
