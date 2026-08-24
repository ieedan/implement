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

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/context-menu.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

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

## Styled like the dropdown menu

The panels, items, separators, and indicators are drawn to match the [dropdown menu](/ui/dropdown-menu), but the classes live in this file — it installs on its own, and editing it restyles the context menu and nothing else.

## API Reference

Every prop the styling does not consume is forwarded to the [Context Menu primitive](/primitives/docs/context-menu), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-context-menu"></div>
