import {
	Div,
	Implement,
	Portal,
	signal,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Signal,
} from "@implementjs/core";
import type { VirtualAnchor } from "../helpers/floating-ui";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import {
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
export const ContextMenu = createComponent(function ContextMenu(props: ContextMenuRootProps, ...children: Child[]) {
	const state = new ContextMenuState(props);
	return MenuRoot(state, ...children);
});

export type ContextMenuTriggerProps = ComponentProps<typeof Div> & {
	disabled?: Signal<boolean> | boolean;
};

export const ContextMenuTrigger = createComponent(function ContextMenuTrigger(
	{ id = getId(), disabled = false, ...restProps }: ContextMenuTriggerProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		if (!(state instanceof ContextMenuState)) {
			throw new Error("ContextMenuTrigger must be placed inside ContextMenu");
		}
		const contextState = state;
		const disabledSignal = signal(disabled);
		let longPressTimer: ReturnType<typeof setTimeout> | null = null;

		const clearLongPressTimer = () => {
			if (longPressTimer === null) return;
			clearTimeout(longPressTimer);
			longPressTimer = null;
		};

		return Implement.Lifecycle(
			{ onUnmount: clearLongPressTimer },
			Div(
				mergeProps(
					{
						id,
						this: state.trigger,
						tabIndex: -1,
						[state.attr("trigger")]: "",
						"data-state": state.state,
						"data-disabled": disabledSignal.bind((disabled) => (disabled ? "" : undefined)),
						onContextmenu: (e: MouseEvent) => {
							if (disabledSignal.get()) return;
							e.preventDefault();
							clearLongPressTimer();
							contextState.openAt(e.clientX, e.clientY);
						},
						// long-press opens on touch, where there is no right click
						onPointerdown: (e: PointerEvent) => {
							if (disabledSignal.get() || e.pointerType === "mouse") return;
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
