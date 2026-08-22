---
title: Range Calendar
description: A month grid for picking a start and an end date.
section: Components
---

<div data-demo="range-calendar" data-demo-description="A month calendar with a five-day range selected: rounded ends, a filled band between them, and a highlighted preview span while a new end is being chosen."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/range-calendar
```

jsrepo pulls `button` and [`calendar`](/ui/calendar) along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/range-calendar.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` and [`calendar`](/ui/calendar) from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="range-calendar"></div>

<div data-tabs-end></div>

## Usage

Assembled like the [calendar](/ui/calendar) — navigation, weekday header, and grid built in — with day styling for the shape of a range: rounded ends, a squared-off band through the middle, and a live highlight over the span being picked before the second click lands.

`value` is a `DateRange`: `{ start, end }`, either of which can be `null` while a selection is in progress.

```ts
import { signal } from "@implementjs/core";
import { today, type DateRange } from "@implementjs/primitives";
import { RangeCalendar } from "@/lib/components/ui/range-calendar";

const value = signal<DateRange>({ start: today(), end: today().add({ days: 4 }) });

RangeCalendar({ value, calendarLabel: "Trip dates" });
```

## Two months at a time

`numberOfMonths: 2` is the usual shape for a date range picker; the styled root already lays the months out in a row on wider screens and stacks them below `md`.

```ts
RangeCalendar({ value, numberOfMonths: 2, calendarLabel: "Trip dates" });
```

## What it shares with the calendar

The root's border and padding come from `calendarRootClasses`, exported by `calendar.ts` — which is why installing this brings the calendar with it. The day classes are its own, since a range needs states a single date has no use for.

The root is assembled, so the header, grid, and cell parts are not re-exported here. Import them from `@implementjs/primitives` when you want a different structure; [Range Calendar](/primitives/docs/range-calendar) covers them.

## API Reference

Every prop the styling does not consume is forwarded to the [Range Calendar primitive](/primitives/docs/range-calendar), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-range-calendar"></div>
