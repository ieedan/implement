---
title: Context Menu
description: A menu opened by right-clicking an area.
section: Components
---

<div data-demo="context-menu"></div>

A context menu opens where the pointer is when an area is right-clicked (or long-pressed on touch). `ContextMenu` is the root, `ContextMenuTrigger` the area, and `ContextMenuContent` the panel. It shares its content, items, and keyboard model with [Dropdown Menu](/primitives/docs/dropdown-menu) and [Menubar](/primitives/docs/menubar) — only how the menu opens differs.

```ts
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@implementjs/primitives";

ContextMenu(
	ContextMenuTrigger({ class: "block h-36 rounded-md border border-dashed" }, "Right click here"),
	ContextMenuContent(
		ContextMenuItem({ onSelect: () => reload() }, "Reload"),
		ContextMenuItem({ onSelect: () => inspect() }, "Inspect"),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component).

## Opening

The trigger intercepts the `contextmenu` event, so the browser menu is replaced inside the area. The panel anchors to the pointer position — right-clicking somewhere else while open moves it there. On touch, a long press (700ms) opens it. Pass `disabled` on the trigger to fall back to the native browser menu. While open, the page behind cannot scroll; pass `preventScroll: false` on the root to leave it scrollable.

`open` and `onOpenChange` work as they do on [DropdownMenu](/primitives/docs/dropdown-menu): pass a signal to control the menu, or the callback to be told when it opens and closes.

## Items, structure, and keyboard

Everything inside the panel is the shared menu set: `ContextMenuItem` with `onSelect` and `closeOnSelect`, `ContextMenuCheckboxItem` (grouped into one array of values by `ContextMenuCheckboxGroup`), `ContextMenuRadioGroup` and `ContextMenuRadioItem`, `ContextMenuGroup` with `ContextMenuGroupHeading`, `ContextMenuSeparator`, and nested [submenus](/primitives/docs/dropdown-menu#submenus) via `ContextMenuSub`, `ContextMenuSubTrigger`, and `ContextMenuSubContent`. The keyboard model matches the [dropdown menu](/primitives/docs/dropdown-menu#keyboard): arrows move, typing jumps, Enter and Space activate, ArrowRight and ArrowLeft enter and leave submenus, Escape closes.

## Styling

The primitive does not hide the closed panel — style `ContextMenuContent` against `data-state`, and items against `data-highlighted` and `data-disabled`. Every part sets a `data-context-menu-*` attribute, and the trigger exposes `data-state` so the area itself can react while the menu is open.

## API Reference

<div data-api="context-menu"></div>
