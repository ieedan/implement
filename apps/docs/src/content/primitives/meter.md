---
title: Meter
description: Display a measurement within a known range.
section: Components
---

<div data-demo="meter" data-demo-description="A “Tokens used” meter showing 3000 / 4000 as a labeled bar three quarters full."></div>

A meter is a static measurement within a known range — CPU usage, battery level, a token quota. `Meter` renders a `Div` with `role="meter"` and the aria value attributes; you draw the track and the fill.

```ts
import { Meter } from "@implementjs/primitives";

Meter({ value: 75, "aria-label": "Storage used" });
```

It accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div`.

A meter measures a current state relative to capacity; the value can move in either direction. If the value only ever advances toward completion — a file upload, a multi-step form — that is a progress bar, not a meter, and assistive technology announces the two differently.

## Value and range

`value` defaults to `0` inside a range from `min` (`0`) to `max` (`100`). Pass numbers to seed them, or a [signal](/docs/signals) to control them from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const usage = signal(40);

Meter({ value: usage, max: 200, "aria-label": "CPU usage" });

usage.set(80); // the aria and data attributes follow
```

## Accessibility

The primitive sets `role="meter"`, `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. Two things are left to you:

- **A name.** If there is a visible label, point `aria-labelledby` at its `id`; otherwise pass `aria-label`.
- **A readable value.** Screen readers often announce `aria-valuenow` as a percentage. When a percentage is not how a person would say the value, pass `aria-valuetext` — a battery meter might use `"50% (6 hours) remaining"`.

```ts
Span({ id: "battery-label" }, "Battery");

Meter({
	"aria-labelledby": "battery-label",
	"aria-valuetext": "50% (6 hours) remaining",
	value: 50,
});
```

## Styling

The primitive is invisible until you style it — it has no default size or color. Style the root as the track and put your own fill inside it; `data-value`, `data-min`, and `data-max` are on the root for CSS to react to:

```ts
Meter(
	{
		value: 75,
		"aria-label": "Storage used",
		class: "h-2 w-56 overflow-hidden rounded-full bg-muted",
	},
	Div({ class: "h-full bg-primary", style: { width: "75%" } }),
);
```

For a fill that follows a signal, bind the style:

```ts
const usage = signal(40);

Meter(
	{
		value: usage,
		"aria-label": "CPU usage",
		class: "h-2 w-56 overflow-hidden rounded-full bg-muted",
	},
	Div({ class: "h-full bg-primary", style: { width: usage.bind((v) => `${v}%`) } }),
);
```

## API Reference

<div data-api="meter"></div>
