---
title: Toggle Group
description: A joined row of toggles that share one value.
section: Components
---

<div data-demo="toggle-group" data-demo-description="A three-item formatting group (bold, italic, underline) in the outline variant, with bold pressed."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/toggle-group
```

jsrepo pulls [`toggle`](/ui/toggle) along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/toggle-group.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`toggle`](/ui/toggle) from the same directory — copy those in beside it too.

<div data-source="toggle-group"></div>

<div data-tabs-end></div>

## Usage

The group is styled as a joined row: the items square off against each other and only the ends stay rounded, so an outlined group reads as one control rather than three buttons.

Items take the same `variant` and `size` as a standalone [toggle](/ui/toggle) — set them per item, since that is where the styles land.

```ts
import { signal } from "@implementjs/core";
import { ToggleGroup, ToggleGroupItem } from "@/lib/components/ui/toggle-group";

const value = signal<string[]>(["bold"]);

ToggleGroup(
	{ type: "multiple", value, "aria-label": "Text formatting" },
	ToggleGroupItem(
		{ value: "bold", variant: "outline", "aria-label": "Toggle bold" },
		BoldIcon({ "aria-hidden": true }),
	),
);
```

## Single or multiple

`type` defaults to `"single"` — one item at a time, `value` a `Signal<string | null>`. `"multiple"` lets several stay pressed and makes `value` a `Signal<string[]>`.

## Outline items

In the `outline` variant the items drop their left border except on the first, so adjacent borders do not double up into a thick line. That rule keys off `data-variant`, which the item sets from its own `variant` prop.

## API Reference

Every prop the styling does not consume is forwarded to the [Toggle Group primitive](/primitives/docs/toggle-group), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-toggle-group"></div>
