---
title: Calendar
description: A month grid for picking a single date, or several.
section: Components
---

<div data-demo="calendar" data-demo-description="A month calendar with today selected, previous and next month buttons, and a weekday header."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/calendar
```

jsrepo pulls `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/calendar.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="calendar"></div>

<div data-tabs-end></div>

## Usage

The styled calendar is assembled, not composed: `Calendar` renders the navigation, the weekday header, and the day grid itself, so a whole date picker is one call. Every root prop from the primitive is forwarded — `value`, `type`, `minValue`, `isDateUnavailable`, `numberOfMonths`, and the rest.

```ts
import { signal } from "@implementjs/core";
import { today, type CalendarDate } from "@implementjs/primitives";
import { Calendar } from "@/lib/components/ui/calendar";

const value = signal<CalendarDate | null>(today());

Calendar({ value, calendarLabel: "Appointment date" });
```

## Multiple dates

`type: "multiple"` turns `value` into a `Signal<CalendarDate[]>`:

```ts
const dates = signal<CalendarDate[]>([]);

Calendar({ type: "multiple", value: dates, calendarLabel: "Available days" });
```

## Building your own layout

The file exports its pieces so you do not have to fork it to rearrange them. `calendarRootClasses` and `calendarDayClasses` are the class strings; `CalendarNav()` is the header row; `CalendarMonthGrid(month, weekdays)` is one month, weekday header included. Its trailing arguments — `Cell`, `Day`, `dayClasses` — are the seams the [range calendar](/ui/range-calendar) uses to swap in its own cells.

Drop down to the primitive's own parts when you want a different structure entirely; [Calendar](/primitives/docs/calendar) covers them.

## API Reference

Every prop the styling does not consume is forwarded to the [Calendar primitive](/primitives/docs/calendar), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-calendar"></div>
