---
title: Radio Group
description: Choose exactly one option from a set.
section: Components
---

<div data-demo="radio-group"></div>

A radio group is a set of options where choosing one deselects the rest. `RadioGroup` is the root and owns the value; each `RadioGroupItem` is one option, rendered as a `Button` with `role="radio"`.

```ts
import { RadioGroup, RadioGroupItem } from "@implementjs/primitives";

RadioGroup(
	{ "aria-label": "Density" },
	RadioGroupItem({ value: "default" }),
	RadioGroupItem({ value: "comfortable" }),
	RadioGroupItem({ value: "compact" }),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

## Value

`RadioGroup` owns which item is checked. Pass a string to seed it, or a [signal](/docs/signals) holding `string | null` to control it from outside:

```ts
const density = signal<string | null>("comfortable");

RadioGroup(
	{ value: density, "aria-label": "Density" },
	RadioGroupItem({ value: "default" }),
	RadioGroupItem({ value: "comfortable" }),
	RadioGroupItem({ value: "compact" }),
);

density.set("compact"); // checks it from outside
```

Clicking an item checks it. `null` means nothing is checked yet; a radio group cannot be uncleared by clicking.

`onValueChange` reports the checked item after each change, so a form can react without owning the signal.

## Keyboard and focus

The group is one Tab stop: Tab lands on the checked item, and arrow keys move between the options — moving also checks, the way native radios work. `loop` (default `true`) wraps from the last item to the first, and Home and End jump to the ends. `orientation` (default `"vertical"`) is announced to assistive technology and lands on the `data-orientation` attributes; all four arrow keys move focus either way.

## Disabled

Pass `disabled` on the group to disable every item, or on one item to disable just it. Both accept a signal, set the native `disabled` attribute, and add `data-disabled` for styling. Disabled items are skipped by the arrow keys.

```ts
RadioGroup(
	{ "aria-label": "Plan" },
	RadioGroupItem({ value: "free" }),
	RadioGroupItem({ value: "team", disabled: true }),
);
```

## Accessibility

The root sets `role="radiogroup"` and each item `role="radio"` with `aria-checked`. Two things are left to you:

- **A name for the group.** Point `aria-labelledby` at a visible heading's `id`, or pass `aria-label`.
- **A label per item.** Items render as empty buttons; pair each with a `Label` whose `for` matches the item's `id`, or pass `aria-label`.

`required` sets `aria-required` on the group.

## Styling

The root sets `data-radio-group-root` and items set `data-radio-group-item`, with `data-state` as `"checked"` or `"unchecked"`, plus `data-value`, `data-orientation`, and `data-disabled`:

```ts
RadioGroupItem({
	value: "compact",
	class: "size-4 rounded-full border data-[state=checked]:border-primary",
});
```

Put your own indicator inside the item — a dot, a check, anything — and show it against `data-state`.

## API Reference

<div data-api="radio-group"></div>
