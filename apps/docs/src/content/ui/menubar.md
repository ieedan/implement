---
title: Menubar
description: A row of menus that hand off to one another, the way an application menu bar does.
section: Components
---

<div data-demo="menubar" data-demo-description="A File / Edit / View menu bar; opening one menu and moving across the bar opens the next without a second click, with a word-wrap checkbox and a theme radio group under View."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/menubar
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/menubar.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="menubar"></div>

<div data-tabs-end></div>

## Usage

A menubar is a row of [dropdown menus](/ui/dropdown-menu) that share focus: once one is open, moving along the bar opens the next without another click, and the arrow keys walk the whole bar.

The bar itself is styled as a bordered strip; the triggers are compact titles that fill in while highlighted or open. The panels and items are the shared menu styles.

```ts
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarTrigger,
} from "@/lib/components/ui/menubar";

Menubar(
	MenubarMenu(
		{ value: "file" },
		MenubarTrigger("File"),
		MenubarContent(
			{ class: "w-48" },
			MenubarItem({ onSelect: newFile }, "New file"),
			MenubarSeparator(),
			MenubarItem({ disabled: true }, "Save all"),
		),
	),
);
```

## Every menu needs a value

`MenubarMenu` takes a `value` — a stable string the bar tracks as its open menu. Pass a signal as the root's `value` to open one from outside, or to know which is open.

## Styled like the dropdown menu

The panels, items, separators, and indicators are drawn to match the [dropdown menu](/ui/dropdown-menu), but the classes live in this file — it installs on its own, and editing it restyles the menubar and nothing else.

## API Reference

Every prop the styling does not consume is forwarded to the [Menubar primitive](/primitives/docs/menubar), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-menubar"></div>
