---
title: Dropdown Menu
description: A menu of actions hanging off a trigger button.
section: Components
---

<div data-demo="dropdown-menu" data-demo-description="An “Open menu” button opening a menu with a My Account group, an Invite people submenu, a Status bar checkbox item, and a radio group of panel positions."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/dropdown-menu
```

jsrepo pulls `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/dropdown-menu.ts`. It imports `button` from the same directory, so install that too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="dropdown-menu"></div>

<div data-tabs-end></div>

## Usage

`DropdownMenuTrigger` renders through the button styles and defaults to `outline`. Everything below it is the shared menu look: a popover panel that scales in from the side it opens on, items that fill in when highlighted, and check and radio indicators in a fixed left gutter so labels line up whether or not an item has one.

Submenus open without a transition — a submenu should feel instant, not animated.

```ts
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupHeading,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/lib/components/ui/dropdown-menu";

DropdownMenu(
	DropdownMenuTrigger("Open menu"),
	DropdownMenuContent(
		{ class: "w-56" },
		DropdownMenuGroup(
			DropdownMenuGroupHeading("My Account"),
			DropdownMenuItem({ onSelect: profile }, "Profile"),
			DropdownMenuItem({ disabled: true }, "Settings"),
		),
		DropdownMenuSeparator(),
		DropdownMenuItem({ onSelect: signOut }, "Sign out"),
	),
);
```

## Checkbox and radio items

Both render their own indicator, so the item is just its label. A checkbox item usually wants `closeOnSelect: false` — toggling a setting is not leaving the menu:

```ts
DropdownMenuCheckboxItem({ checked: showStatusBar, closeOnSelect: false }, "Status bar");

DropdownMenuRadioGroup(
	{ value: position },
	DropdownMenuRadioItem({ value: "top" }, "Top"),
	DropdownMenuRadioItem({ value: "bottom" }, "Bottom"),
);
```

## The shared menu styles

This file is the source of the menu look. `menuContentClasses`, `menuItemClasses`, `menuGroupHeadingClasses`, and the indicator helpers are exported and reused by the [context menu](/ui/context-menu), the [menubar](/ui/menubar), and the [select](/ui/select) — so those three install this file alongside their own, and restyling every menu at once means editing one.

## API Reference

Every prop the styling does not consume is forwarded to the [Dropdown Menu primitive](/primitives/docs/dropdown-menu), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-dropdown-menu"></div>
