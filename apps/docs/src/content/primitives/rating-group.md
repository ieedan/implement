---
title: Rating Group
description: Pick a rating from a range of values.
section: Components
---

<div data-demo="rating-group"></div>

A rating group is a row of steps — usually stars — for choosing a value out of a maximum. `RatingGroup` is the root and the single focusable control; each `RatingGroupItem` is one visual step you fill with an icon.

```ts
import { RatingGroup, RatingGroupItem } from "@implementjs/primitives";

RatingGroup(
	{ "aria-label": "Rate this product" },
	...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index }, StarIcon())),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div`s. Items take a zero-based `index`; the item represents the rating `index + 1`.

## Value and range

`value` defaults to `0` inside a range from `min` (`0`) to `max` (`5`). Pass a number to seed it, or a [signal](/docs/signals) to control it from outside:

```ts
const rating = signal(3);

RatingGroup(
	{ value: rating, "aria-label": "Rate this product" },
	...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index })),
);
```

Clicking a step sets the value. Clicking the first step when it is already the value clears the rating back to `0` (when `min` is `0`).

`onValueChange` reports the rating after each change, so a form can submit it without owning the signal. The hover preview is not a change: it moves `data-state` on the items and leaves `value` alone until a click lands.

## Half steps and hover

Pass `allowHalf` to work in half steps: the pointer's position inside an item picks the half, arrow keys move by `0.5`, and an item halfway filled gets `data-state="partial"`.

While the pointer moves across the group, the steps preview the value it would take; the preview reverts on leave. Pass `hoverPreview: false` to turn that off. `readonly` shows a value that cannot be changed, and `disabled` also removes the group from the Tab order.

## Keyboard

The root is a single Tab stop. Arrow keys adjust the value by one step (or half with `allowHalf`), Home and End jump to `min` and `max`, PageUp and PageDown always move by a whole step, and typing a number picks it directly.

## Accessibility

The root announces as a slider — `role="slider"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` — because a rating is one value out of a range, not a set of separate buttons. Items are `role="presentation"`. Two things to know:

- The default `aria-label` is `"Rating"` and the default `aria-valuetext` reads `"3 out of 5"`. Pass your own to be specific: `aria-label: "Rate this product"`.
- Keep the icons inside items `aria-hidden`; the root carries all the semantics.

## Styling

The root sets `data-rating-group-root` and items set `data-rating-group-item`, with `data-state` as `"active"`, `"partial"`, or `"inactive"`, plus `data-value`, `data-orientation`, `data-disabled`, and `data-readonly`:

```ts
RatingGroupItem(
	{ index, class: "group/star" },
	StarIcon({ "aria-hidden": true, class: "size-5 group-data-[state=active]/star:fill-current" }),
);
```

Fill against `data-state` — solid for `"active"`, half for `"partial"` when you use `allowHalf`.

## API Reference

<div data-api="rating-group"></div>
