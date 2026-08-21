---
title: Item
description: A row with media, a title, and controls.
section: Components
---

<div data-demo="item" data-demo-description="A bordered list: a notifications row with an icon tile, a New badge, a description, and a switch, then a small billing row with a chevron."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/item
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/item.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="item"></div>

<div data-tabs-end></div>

## Usage

A settings row, a search result, a file listing, a member of a team — they turn out to be the same shape. `Item` is that shape.

```ts
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/lib/components/ui/item";

ItemGroup(
	Item(
		ItemMedia({ variant: "icon" }, BellIcon({ "aria-hidden": true })),
		ItemContent(ItemTitle("Notifications"), ItemDescription("Get told when a build breaks.")),
		ItemActions(Switch({ "aria-label": "Notifications" })),
	),
);
```

## Media alignment

`ItemMedia` centers itself on a single-line row and jumps to the top when the row has a description — `group-has-[[data-slot=item-description]]/item:self-start`. Nothing to set: adding a description moves the icon.

## Variants

`outline` gives the row a border, `muted` a fill; `size: "sm"` tightens the padding for a dense list. A row that navigates can be an `A` with the same classes, and the hover state (`[a&]:hover:bg-accent/50`) switches on only then.

## Headers and footers

`ItemHeader` and `ItemFooter` are full-width rows above and below the main line — the root wraps, and both are `basis-full`, so they break onto their own line without any extra layout.

## API Reference

<div data-api="ui-item"></div>
