---
title: Radio Group
description: One choice out of several.
section: Components
---

<div data-demo="radio-group" data-demo-description="A Density radio group with Default, Comfortable, and Compact options, Comfortable selected."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/radio-group
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/radio-group.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="radio-group"></div>

<div data-tabs-end></div>

## Usage

The group is a vertical grid; each item renders its own dot unless you pass children. Roving focus, arrow-key navigation, and the single-selection invariant are the primitive's.

```ts
import { RadioGroup, RadioGroupItem } from "@/lib/components/ui/radio-group";

RadioGroup(
	{ value: "comfortable", "aria-label": "Density" },
	Div(
		{ class: "flex items-center gap-2" },
		RadioGroupItem({ id: "comfortable", value: "comfortable" }),
		Label({ for: "comfortable", class: "text-sm font-medium" }, "Comfortable"),
	),
);
```

Give each item an `id` and point a `Label` at it, the same as a [checkbox](/ui/checkbox) — the item is a `Button`, not an `input`.

## Controlled

Pass a signal as the group's `value` to read or set the choice from outside:

```ts
const density = signal<string | null>("comfortable");

RadioGroup({ value: density, "aria-label": "Density" } /* items */);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Radio Group primitive](/primitives/docs/radio-group), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-radio-group"></div>
