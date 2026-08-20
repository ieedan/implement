import {
	Button,
	context,
	Div,
	Portal,
	ref,
	signal,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import {
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

export type MenubarRootProps = ComponentProps<typeof Div> & {
	/** The value of the open menu, or null while all are closed. */
	value?: Signal<string | null> | string | null;
	/** Whether arrow keys wrap from the last trigger back to the first. */
	loop?: boolean;
};

const MenubarCtx = context<MenubarState>();

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
export function Menubar(
	{ id = getId(), value, loop = true, ...restProps }: MenubarRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new MenubarState({ loop }, root, value);

	return MenubarCtx.Provide(state).To(
		Div(
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
}

export type MenubarMenuProps = {
	/** Identifies the menu. Must be unique within the menubar. */
	value: string;
};

const MenubarMenuCtx = context<{ value: string; menu: MenuState; menubar: MenubarState }>();

export function MenubarMenu({ value }: MenubarMenuProps, ...children: Child[]) {
	return MenubarCtx.Use((menubar) => {
		const menu = new MenuState("menubar", {});
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
}

export type MenubarTriggerProps = Omit<ComponentProps<typeof Button>, "disabled"> & {
	disabled?: Signal<boolean> | boolean;
};

export function MenubarTrigger(
	{ id = getId(), disabled = false, ...restProps }: MenubarTriggerProps,
	...children: Child[]
) {
	return MenubarMenuCtx.Use(({ value, menu, menubar }) => {
		const disabledSignal = signal(disabled);
		const highlighted = signal(false);

		return Button(
			mergeProps(
				{
					id,
					type: "button",
					// within the bar, each trigger is a menu item of the menubar itself
					role: "menuitem",
					...menuTriggerProps(menu, { disabled: disabledSignal }),
					"data-highlighted": highlighted.bind((h) => (h ? "" : undefined)),
					tabIndex: menubar.tabStop.bind((tabStop) => (tabStop === value ? 0 : -1)),
					onPointerdown: (e: PointerEvent) => {
						if (disabledSignal.get() || e.button !== 0 || e.ctrlKey) return;
						// keep the browser from focusing the trigger over the opening content
						if (!menu.open.get()) e.preventDefault();
						menu.toggleOpen(false);
					},
					onPointerenter: () => {
						if (disabledSignal.get()) return;
						// while a menu is open, hovering another trigger switches to it
						if (menubar.value.get() !== null && !menu.open.get()) {
							menu.openMenu(false);
							menu.trigger.get()?.focus();
						}
					},
					onKeydown: (e: KeyboardEvent) => {
						if (disabledSignal.get()) return;
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
						if (disabledSignal.get()) return;
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
}

export type MenubarContentProps = MenuContentProps;
export const MenubarContent = MenuContent;

export type MenubarItemProps = MenuItemProps;
export const MenubarItem = MenuItem;

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
