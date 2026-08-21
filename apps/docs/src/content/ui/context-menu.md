---
title: Context Menu
description: A menu opened by right-clicking a region of the page.
section: Components
---

<div data-demo="context-menu" data-demo-description="A dashed drop zone labelled “Right click here”; right-clicking opens a menu of navigation and page commands with a Share submenu."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/context-menu
```

jsrepo pulls [`dropdown-menu`](/ui/dropdown-menu) along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/context-menu.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`dropdown-menu`](/ui/dropdown-menu) from the same directory — copy those in beside it too.

<div data-source="context-menu"></div>

<div data-tabs-end></div>

## Usage

The same menu as the [dropdown](/ui/dropdown-menu), anchored to the pointer instead of a trigger button. `ContextMenuTrigger` is the region you right-click, and it is passed straight through from the primitive — it has no styling of its own, so the region is yours to define.

```ts
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/lib/components/ui/context-menu";

ContextMenu(
	ContextMenuTrigger({ class: "rounded-md border border-dashed p-8" }, "Right click here"),
	ContextMenuContent(
		{ class: "w-52" },
		ContextMenuItem({ onSelect: back }, "Back"),
		ContextMenuItem({ disabled: true }, "Forward"),
		ContextMenuSeparator(),
		ContextMenuItem({ onSelect: inspect }, "Inspect"),
	),
);
```

## Shared with the dropdown menu

Every panel and item class comes from `dropdown-menu.ts` — `menuContentClasses`, `menuItemClasses`, and the check and chevron indicators are exported from there and used here, by the [menubar](/ui/menubar), and by the [select](/ui/select)'s group headings. Restyling the menus is one file, not four.

That is also why installing this one brings `dropdown-menu` with it.

## API Reference

Every prop the styling does not consume is forwarded to the [Context Menu primitive](/primitives/docs/context-menu), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-context-menu"></div>
