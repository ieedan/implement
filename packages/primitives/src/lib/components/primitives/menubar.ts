import {
	Button,
	context,
	Div,
	Portal,
	ref,
	signal,
	type Child,
	type PortalProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import {
	MenuCheckboxGroup,
	MenuCheckboxItem,
	MenuContent,
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
	type MenuSeparatorProps,
	type MenuSubContentProps,
	type MenuSubProps,
	type MenuSubTriggerProps,
} from "./menu";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type MenubarRootProps = RenderableProps<typeof Div> & {
	/** The value of the open menu, or null while all are closed. */
	value?: Signal<string | null> | string | null;
	/** Runs whenever the open menu changes. `null` once every menu is closed. */
	onValueChange?: ChangeHandler<string | null>;
	/** Whether arrow keys wrap from the last trigger back to the first. */
	loop?: boolean;
};

const MenubarCtx = context<MenubarState>("MenubarCtx");

class MenubarState {
	value: Signal<string | null>;
	/** The one trigger reachable with Tab; arrow keys move between the rest. */
	tabStop = signal<string | null>(null);
	/** Menus in tree order, for arrow-key switching between them. */
	menus = new Map<string, MenuState>();
	constructor(
		readonly opts: { loop: boolean },
		readonly ref: Ref<HTMLDivElement>,
		value: MenubarRootProps["value"],
	) {
		this.value = signal(value ?? null);
	}

	registerMenu(value: string, menu: MenuState) {
		this.menus.set(value, menu);
		if (this.tabStop.get() === null) this.tabStop.set(value);
	}

	/** Close the open menu and open its neighbor, the way native menubars arrow between menus. */
	switchMenu(direction: 1 | -1) {
		const values = Array.from(this.menus.keys());
		const current = this.value.get();
		if (current === null || values.length < 2) return;

		const index = values.indexOf(current);
		const next = values[(index + direction + values.length) % values.length];
		if (next === undefined || next === current) return;

		this.menus.get(current)?.close(false);
		this.menus.get(next)?.openMenu(true);
		this.tabStop.set(next);
	}

	onTriggerKeydown(e: KeyboardEvent) {
		handleRovingKeydown(e, {
			root: this.ref,
			candidateAttr: "data-menubar-trigger",
			loop: this.opts.loop,
			orientation: "horizontal",
		});
	}
}

/**
 * A horizontal bar of menus, like an application's File / Edit / View bar.
 * Each MenubarMenu is a full menu built on the shared menu base; the bar
 * owns which one is open, hover-switches between them while one is open,
 * and arrows move both between triggers and between open menus.
 */
export const Menubar = createComponent(function Menubar(
	{ id = getId(), value, onValueChange, loop = true, render = Div, ...restProps }: MenubarRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new MenubarState({ loop }, root, value);

	return MenubarCtx.Provide(state).To(
		...changeEffect(state.value, onValueChange),
		render(
			mergeProps(
				{
					id,
					this: root,
					role: "menubar",
					"data-menubar-root": "",
					"data-orientation": "horizontal",
				},
				restProps,
			),
			...children,
		),
	);
});

export type MenubarMenuProps = {
	/** Identifies the menu. Must be unique within the menubar. */
	value: string;
	/** When true, the page behind cannot scroll while this menu is open. Defaults to true. */
	preventScroll?: boolean;
};

const MenubarMenuCtx = context<{ value: string; menu: MenuState; menubar: MenubarState }>(
	"MenubarMenuCtx",
);

export const MenubarMenu = createComponent(function MenubarMenu(
	{ value, preventScroll }: MenubarMenuProps,
	...children: Child[]
) {
	return MenubarCtx.Use((menubar) => {
		const menu = new MenuState("menubar", { preventScroll });
		menubar.registerMenu(value, menu);

		// the bar's value and each menu's open state mirror each other
		menu.open.subscribe((open) => {
			if (open) {
				menubar.value.set(value);
			} else if (menubar.value.get() === value) {
				menubar.value.set(null);
			}
		});
		menubar.value.subscribe((current) => {
			if (current === value) {
				if (!menu.open.get()) menu.openMenu(false);
			} else {
				menu.close(false);
			}
		});

		menu.onContentNavigationKeydown = (e: KeyboardEvent) => {
			if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
			e.preventDefault();
			menubar.switchMenu(e.key === "ArrowRight" ? 1 : -1);
		};

		return MenubarMenuCtx.Provide({ value, menu, menubar }).To(MenuRoot(menu, ...children));
	});
});

export type MenubarTriggerProps = Omit<RenderableProps<typeof Button>, "disabled"> & {
	disabled?: Readable<boolean> | boolean;
};

export const MenubarTrigger = createComponent(function MenubarTrigger(
	{ id = getId(), disabled = false, render = Button, ...restProps }: MenubarTriggerProps,
	...children: Child[]
) {
	return MenubarMenuCtx.Use(({ value, menu, menubar }) => {
		const isDisabled = toReadable(disabled);
		const highlighted = signal(false);

		return render(
			mergeProps(
				{
					id,
					type: "button",
					// within the bar, each trigger is a menu item of the menubar itself
					role: "menuitem",
					...menuTriggerProps(menu, { disabled: isDisabled }),
					"data-highlighted": highlighted.bind((h) => (h ? "" : undefined)),
					tabIndex: menubar.tabStop.bind((tabStop) => (tabStop === value ? 0 : -1)),
					onPointerdown: (e: PointerEvent) => {
						if (isDisabled.get() || e.button !== 0 || e.ctrlKey) return;
						// keep the browser from focusing the trigger over the opening content
						if (!menu.open.get()) e.preventDefault();
						menu.toggleOpen(false);
					},
					onPointerenter: () => {
						if (isDisabled.get()) return;
						// while a menu is open, hovering another trigger switches to it
						if (menubar.value.get() !== null && !menu.open.get()) {
							menu.openMenu(false);
							menu.trigger.get()?.focus();
						}
					},
					onKeydown: (e: KeyboardEvent) => {
						if (isDisabled.get()) return;
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							menu.toggleOpen(true);
							return;
						}
						if (e.key === "ArrowDown") {
							e.preventDefault();
							menu.openMenu(true);
							return;
						}
						menubar.onTriggerKeydown(e);
					},
					onFocus: () => {
						if (isDisabled.get()) return;
						highlighted.set(true);
						menubar.tabStop.set(value);
					},
					onBlur: () => highlighted.set(false),
				},
				restProps,
			),
			...children,
		);
	});
});

export type MenubarContentProps = MenuContentProps;
export const MenubarContent = MenuContent;

export type MenubarItemProps = MenuItemProps;
export const MenubarItem = MenuItem;

export type MenubarCheckboxGroupProps = MenuCheckboxGroupProps;
export const MenubarCheckboxGroup = MenuCheckboxGroup;

export type MenubarCheckboxItemProps = MenuCheckboxItemProps;
export const MenubarCheckboxItem = MenuCheckboxItem;

export type MenubarRadioGroupProps = MenuRadioGroupProps;
export const MenubarRadioGroup = MenuRadioGroup;

export type MenubarRadioItemProps = MenuRadioItemProps;
export const MenubarRadioItem = MenuRadioItem;

export type MenubarGroupProps = MenuGroupProps;
export const MenubarGroup = MenuGroup;

export type MenubarGroupHeadingProps = MenuGroupHeadingProps;
export const MenubarGroupHeading = MenuGroupHeading;

export type MenubarSeparatorProps = MenuSeparatorProps;
export const MenubarSeparator = MenuSeparator;

export type MenubarSubProps = MenuSubProps;
export const MenubarSub = MenuSub;

export type MenubarSubTriggerProps = MenuSubTriggerProps;
export const MenubarSubTrigger = MenuSubTrigger;

export type MenubarSubContentProps = MenuSubContentProps;
export const MenubarSubContent = MenuSubContent;

export type MenubarPortalProps = PortalProps;
export const MenubarPortal = Portal;
