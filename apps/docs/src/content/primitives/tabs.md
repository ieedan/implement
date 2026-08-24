---
title: Tabs
description: A set of panels where one shows at a time.
section: Components
---

<div data-demo="tabs" data-demo-description="An “Account” and “Password” tab strip; the selected tab shows a small form with a field and a save button."></div>

Tabs split one region into layers the reader switches between — settings sections, a preview next to its source. `Tabs` is the root and owns the selected value, `TabsList` holds the triggers, and each `TabsContent` is the panel for one value.

```ts
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@implementjs/primitives";

Tabs(
	{ value: "account" },
	TabsList(
		TabsTrigger({ value: "account" }, "Account"),
		TabsTrigger({ value: "password" }, "Password"),
	),
	TabsContent({ value: "account" }, "Change your name here."),
	TabsContent({ value: "password" }, "Pick a new password here."),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

A trigger and its panel are paired by `value`, and the pairing is what wires `aria-controls` and `aria-labelledby` between them — so the two must match exactly.

## Value

`value` is the selected tab. Pass a [signal](/docs/signals) to control it from outside — reading it tells you which tab is showing, and setting it switches tabs without a click:

```ts
const tab = signal("account");

Tabs(
	{ value: tab },
	TabsList(TabsTrigger({ value: "account" }, "Account")),
	TabsContent({ value: "account" }, "Change your name here."),
);
```

A plain string seeds uncontrolled state instead. Omitting it starts with nothing selected: every panel is hidden and every trigger is reachable with Tab until one is picked.

`onValueChange` reports the selected tab after each change, so a page can react to the switch without owning the signal.

## Activation

`activationMode` (default `"automatic"`) selects a tab as soon as its trigger is focused, so arrowing through the list swaps panels as you go. Use `"manual"` when a panel is expensive to show — arrow keys then only move focus, and Space, Enter, or a click selects.

```ts
Tabs({ value: "preview", activationMode: "manual" } /* ... */);
```

## Keyboard and focus

The list is one Tab stop: arrow keys move between the triggers, `loop` (default `true`) wraps at the ends, and Home and End jump to them. `orientation` (default `"horizontal"`) picks which arrows move — Left/Right when horizontal, Up/Down when vertical. Disabled triggers are skipped.

Each panel is itself focusable (`tabindex="0"`), so Tab out of the list lands on the content even when it holds no focusable elements.

## Disabled

Pass `disabled` on the root to disable every trigger, or on one trigger to disable just it. Both accept a signal, set the native `disabled` attribute, and add `data-disabled` for styling.

## Accessibility

The list is `role="tablist"` with `aria-orientation`, each trigger is `role="tab"` with `aria-selected` and `aria-controls`, and each panel is `role="tabpanel"` labelled by its trigger. Name the list with `aria-label` or `aria-labelledby` when the page has more than one.

Hidden panels use the `hidden` attribute, so their content stays out of the accessibility tree and out of find-in-page.

## Styling

The parts set `data-tabs-root`, `data-tabs-list`, `data-tabs-trigger`, and `data-tabs-content`. Triggers and panels carry `data-state` as `"active"` or `"inactive"`, plus `data-value`, `data-orientation`, and `data-disabled`:

```ts
TabsTrigger({
	value: "account",
	class: "rounded-md px-2 py-1 text-sm data-[state=active]:bg-background",
});
```

## API Reference

<div data-api="tabs"></div>
