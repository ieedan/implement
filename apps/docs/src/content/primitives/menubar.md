---
title: Menubar
description: A horizontal bar of menus, like an application menu.
section: Components
---

<div data-demo="menubar"></div>

A menubar is a row of menus — File, Edit, View. `Menubar` is the bar, each `MenubarMenu` is one menu identified by a `value`, with a `MenubarTrigger` in the bar and a `MenubarContent` panel. It shares its content, items, and keyboard model with [Dropdown Menu](/primitives/docs/dropdown-menu) and [Context Menu](/primitives/docs/context-menu).

```ts
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@implementjs/primitives";

Menubar(
	MenubarMenu(
		{ value: "file" },
		MenubarTrigger("File"),
		MenubarContent(MenubarItem({ onSelect: () => save() }, "Save")),
	),
	MenubarMenu(
		{ value: "edit" },
		MenubarTrigger("Edit"),
		MenubarContent(MenubarItem({ onSelect: () => undo() }, "Undo")),
	),
);
```

## One open menu

The bar owns which menu is open — `value` holds the open menu's value, or `null`. Opening one closes another, and while any menu is open, hovering a different trigger switches to it, the way native application menus feel. Pass a signal as `value` to control it from outside. While a menu is open, the page behind cannot scroll; pass `preventScroll: false` on that `MenubarMenu` to leave it scrollable.

`onValueChange` reports which menu is open after each change, and `null` once they all close.

## Keyboard

The bar is one Tab stop. Left and Right arrows move between triggers (wrapping unless `loop: false`); Enter, Space, or ArrowDown opens the focused menu with its first item focused. Inside an open menu the shared model applies — arrows move, typing jumps, Enter activates, Escape closes — and Left/Right close the open menu and open its neighbor.

## Items and structure

Panels hold the shared menu set: `MenubarItem` with `onSelect` and `closeOnSelect`, `MenubarCheckboxItem` (grouped into one array of values by `MenubarCheckboxGroup`), `MenubarRadioGroup` and `MenubarRadioItem`, `MenubarGroup` with `MenubarGroupHeading`, `MenubarSeparator`, and nested [submenus](/primitives/docs/dropdown-menu#submenus) via `MenubarSub`, `MenubarSubTrigger`, and `MenubarSubContent` — inside a submenu, Left and Right move within it rather than switching menubar menus.

## Accessibility and styling

The bar is `role="menubar"` and each trigger `role="menuitem"` with `aria-haspopup` and `aria-expanded`; panels are `role="menu"`. The primitive does not hide closed panels — style `MenubarContent` against `data-state`. Triggers expose `data-state` and `data-highlighted`; items expose `data-highlighted` and `data-disabled`. Every part sets a `data-menubar-*` attribute.

## API Reference

<div data-api="menubar"></div>
