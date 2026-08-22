---
title: Checkbox
description: A box that is on, off, or partly on.
section: Components
---

<div data-demo="checkbox" data-demo-description="Four labeled checkboxes: unchecked (Accept terms and conditions), checked (Send me product updates), indeterminate (Select all notifications), and checked but disabled."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/checkbox
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/checkbox.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="checkbox"></div>

<div data-tabs-end></div>

## Usage

Pass nothing and the checkbox renders its own indicator: a check while checked, a dash while indeterminate. Pass children and they replace it.

`checked` takes a signal for a controlled box, and `"indeterminate"` for the third state — the parent of a partly-selected list.

```ts
import { signal } from "@implementjs/core";
import { Checkbox } from "@/lib/components/ui/checkbox";

const accepted = signal(false);

Checkbox({ id: "terms", checked: accepted });
```

## With a label

The checkbox is a `Button`, not an `input`, so a `Label` points at it by `for` and `id` like any other control:

```ts
Div(
	{ class: "flex items-center gap-2" },
	Checkbox({ id: "terms" }),
	Label({ for: "terms", class: "text-sm leading-none font-medium" }, "Accept terms"),
);
```

## Invalid state

`aria-invalid` is styled as well as announced — the border and focus ring turn destructive:

```ts
Checkbox({ id: "terms", "aria-invalid": true });
```

## API Reference

Every prop the styling does not consume is forwarded to the [Checkbox primitive](/primitives/docs/checkbox), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-checkbox"></div>
