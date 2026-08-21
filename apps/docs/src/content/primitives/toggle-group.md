---
title: Toggle Group
description: A set of two-state buttons that toggle together.
section: Components
---

<div data-demo="toggle-group"></div>

A toggle group is a row of [Toggle](/primitives/docs/toggle)-like buttons that share state — text formatting, view switchers, filters. `ToggleGroup` is the root and owns the value; each `ToggleGroupItem` is one `Button`.

```ts
import { ToggleGroup, ToggleGroupItem } from "@implementjs/primitives";

ToggleGroup(
	{ "aria-label": "Text alignment" },
	ToggleGroupItem({ value: "left", "aria-label": "Align left" }, AlignLeftIcon()),
	ToggleGroupItem({ value: "center", "aria-label": "Align center" }, AlignCenterIcon()),
	ToggleGroupItem({ value: "right", "aria-label": "Align right" }, AlignRightIcon()),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

## Single or multiple

`type` (default `"single"`) decides whether pressing an item releases the others, or several can stay on. The value's shape follows: `Signal<string | null>` for `"single"`, `Signal<string[]>` for `"multiple"`. Pass a [signal](/docs/signals) to control it from outside; omit it for uncontrolled state.

```ts
const formats = signal<string[]>(["bold"]);

ToggleGroup(
	{ type: "multiple", value: formats, "aria-label": "Text formatting" },
	ToggleGroupItem({ value: "bold", "aria-label": "Toggle bold" }, BoldIcon()),
	ToggleGroupItem({ value: "italic", "aria-label": "Toggle italic" }, ItalicIcon()),
);
```

In a single group, pressing the active item releases it back to `null`.

## Keyboard and focus

The group is one Tab stop: arrow keys move between the items, `loop` (default `true`) wraps at the ends, and Home and End jump to them. `orientation` (default `"horizontal"`) picks which arrows move — Left/Right when horizontal, Up/Down when vertical. Unlike a radio group, moving focus does not press anything; Space or Enter does.

## Disabled

Pass `disabled` on the group to disable every item, or on one item to disable just it. Both accept a signal, set the native `disabled` attribute, and add `data-disabled` for styling. Disabled items are skipped by the arrow keys.

## Accessibility

The root sets `role="group"`. Items announce by type: in a single group each is `role="radio"` with `aria-checked` (one-of-many), while in a multiple group each keeps `aria-pressed` (independent toggles). Name the group with `aria-label` or `aria-labelledby`, and give icon-only items an `aria-label` describing the action.

## Styling

The root sets `data-toggle-group-root` and items set `data-toggle-group-item`, with `data-state` as `"on"` or `"off"`, plus `data-value`, `data-orientation`, and `data-disabled`:

```ts
ToggleGroupItem({
	value: "bold",
	"aria-label": "Toggle bold",
	class: "rounded-md p-2 hover:bg-muted data-[state=on]:bg-accent",
});
```

## API Reference

<div data-api="toggle-group"></div>
