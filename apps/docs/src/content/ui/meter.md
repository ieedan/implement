---
title: Meter
description: A static measurement inside a known range.
section: Components
---

<div data-demo="meter" data-demo-description="A “Tokens used” meter showing 3000 / 4000 as a labeled bar three quarters full."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/meter
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/meter.ts`.

<div data-source="meter"></div>

<div data-tabs-end></div>

## Usage

A meter is a reading, not a task: disk used, tokens spent, a score out of ten. For something that runs from start to finish, use [progress](/ui/progress) instead.

The wrapper renders the indicator for you and drives it from `value`, `min`, and `max` — the component is one call with no children.

```ts
import { Meter } from "@/lib/components/ui/meter";

Meter({ value: 3000, max: 4000, "aria-label": "Tokens used" });
```

## Labelling it

A meter is usually read alongside its numbers. Put both in a row above the bar and point the meter at the label:

```ts
Div(
	{ class: "grid gap-2" },
	Div(
		{ class: "flex justify-between text-sm" },
		Span({ id: "tokens" }, "Tokens used"),
		Span({ class: "text-muted-foreground tabular-nums" }, "3,000 / 4,000"),
	),
	Meter({ value: 3000, max: 4000, "aria-labelledby": "tokens" }),
);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Meter primitive](/primitives/docs/meter), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-meter"></div>
