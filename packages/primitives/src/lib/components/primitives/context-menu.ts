import {
	Div,
	ImplementLifecycle,
	Portal,
	type Child,
	type PortalProps,
	type Readable,
} from "@implementjs/core";
import type { VirtualAnchor } from "../helpers/floating-ui";
import { mergeProps } from "../../merge-props";
import { getId, toReadable } from "../../utils";
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
import type { RenderableProps } from "../../render";

/** How long a touch must hold before the menu opens, in milliseconds. */
const LONG_PRESS_DURATION = 700;

class ContextMenuState extends MenuState {
	/** Where the menu was opened; the content positions against this point. */
	point = { x: 0, y: 0 };

	constructor(opts: MenuRootOptions) {
		super("context-menu", opts);
	}

	override anchor(): VirtualAnchor {
		return {
			getBoundingClientRect: () =>
				DOMRect.fromRect({ width: 0, height: 0, x: this.point.x, y: this.point.y }),
		};
	}

	openAt(x: number, y: number) {
		this.point = { x, y };
		this.openMenu(false);
	}
}

export type ContextMenuRootProps = MenuRootOptions;

/**
 * A menu opened by right-clicking (or long-pressing) an area, positioned at
 * the pointer. Built on the shared menu base; see DropdownMenu and Menubar
 * for the other flavors.
 */
export const ContextMenu = createComponent(function ContextMenu(
	props: ContextMenuRootProps,
	...children: Child[]
) {
	const state = new ContextMenuState(props);
	return MenuRoot(state, ...children);
});

export type ContextMenuTriggerProps = RenderableProps<typeof Div> & {
	disabled?: Readable<boolean> | boolean;
};

export const ContextMenuTrigger = createComponent(function ContextMenuTrigger(
	{ id = getId(), disabled = false, render = Div, ...restProps }: ContextMenuTriggerProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		if (!(state instanceof ContextMenuState)) {
			throw new Error("ContextMenuTrigger must be placed inside ContextMenu");
		}
		const contextState = state;
		const isDisabled = toReadable(disabled);
		let longPressTimer: ReturnType<typeof setTimeout> | null = null;

		const clearLongPressTimer = () => {
			if (longPressTimer === null) return;
			clearTimeout(longPressTimer);
			longPressTimer = null;
		};

		return ImplementLifecycle(
			{ onUnmount: clearLongPressTimer },
			render(
				mergeProps(
					{
						id,
						this: state.trigger,
						tabIndex: -1,
						[state.attr("trigger")]: "",
						"data-state": state.state,
						"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
						onContextmenu: (e: MouseEvent) => {
							if (isDisabled.get()) return;
							e.preventDefault();
							clearLongPressTimer();
							contextState.openAt(e.clientX, e.clientY);
						},
						// long-press opens on touch, where there is no right click
						onPointerdown: (e: PointerEvent) => {
							if (isDisabled.get() || e.pointerType === "mouse") return;
							clearLongPressTimer();
							longPressTimer = setTimeout(
								() => contextState.openAt(e.clientX, e.clientY),
								LONG_PRESS_DURATION,
							);
						},
						onPointermove: (e: PointerEvent) => {
							if (e.pointerType === "mouse") return;
							clearLongPressTimer();
						},
						onPointerup: (e: PointerEvent) => {
							if (e.pointerType === "mouse") return;
							clearLongPressTimer();
						},
						onPointercancel: (e: PointerEvent) => {
							if (e.pointerType === "mouse") return;
							clearLongPressTimer();
						},
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type ContextMenuContentProps = MenuContentProps;
export const ContextMenuContent = MenuContent;

export type ContextMenuItemProps = MenuItemProps;
export const ContextMenuItem = MenuItem;

export type ContextMenuCheckboxGroupProps = MenuCheckboxGroupProps;
export const ContextMenuCheckboxGroup = MenuCheckboxGroup;

export type ContextMenuCheckboxItemProps = MenuCheckboxItemProps;
export const ContextMenuCheckboxItem = MenuCheckboxItem;

export type ContextMenuRadioGroupProps = MenuRadioGroupProps;
export const ContextMenuRadioGroup = MenuRadioGroup;

export type ContextMenuRadioItemProps = MenuRadioItemProps;
export const ContextMenuRadioItem = MenuRadioItem;

export type ContextMenuGroupProps = MenuGroupProps;
export const ContextMenuGroup = MenuGroup;

export type ContextMenuGroupHeadingProps = MenuGroupHeadingProps;
export const ContextMenuGroupHeading = MenuGroupHeading;

export type ContextMenuSeparatorProps = MenuSeparatorProps;
export const ContextMenuSeparator = MenuSeparator;

export type ContextMenuSubProps = MenuSubProps;
export const ContextMenuSub = MenuSub;

export type ContextMenuSubTriggerProps = MenuSubTriggerProps;
export const ContextMenuSubTrigger = MenuSubTrigger;

export type ContextMenuSubContentProps = MenuSubContentProps;
export const ContextMenuSubContent = MenuSubContent;

export type ContextMenuPortalProps = PortalProps;
export const ContextMenuPortal = Portal;
