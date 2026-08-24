---
title: Range Calendar
description: Pick a span of days from a month grid.
section: Components
---

<div data-demo="range-calendar"></div>

A range calendar is a [calendar](/primitives/docs/calendar) that selects a span of days instead of a single date. The parts and layout are the same — the root takes a render function receiving `months` and `weekdays` — with `RangeCalendarCell` and `RangeCalendarDay` carrying the extra range state:

```ts
import {
	RangeCalendar,
	RangeCalendarCell,
	RangeCalendarDay,
	RangeCalendarGrid,
	RangeCalendarGridBody,
	RangeCalendarGridHead,
	RangeCalendarGridRow,
	RangeCalendarHeadCell,
	RangeCalendarHeader,
	RangeCalendarHeading,
	RangeCalendarNextButton,
	RangeCalendarPrevButton,
} from "@implementjs/primitives";
import { ForEach, Fragment } from "@implementjs/core";

RangeCalendar({ calendarLabel: "Trip dates" }, ({ months, weekdays }) =>
	Fragment(
		RangeCalendarHeader(
			RangeCalendarPrevButton("←"),
			RangeCalendarHeading(),
			RangeCalendarNextButton("→"),
		),
		ForEach(
			months,
			(month) => month.value.toString(),
			(month) =>
				RangeCalendarGrid(
					RangeCalendarGridHead(
						RangeCalendarGridRow(
							ForEach(
								weekdays,
								(_, i) => i,
								(weekday) => RangeCalendarHeadCell(weekday),
							),
						),
					),
					RangeCalendarGridBody(
						ForEach(
							month.bind((m) => m.weeks),
							(week) => week[0].toString(),
							(week) =>
								RangeCalendarGridRow(
									ForEach(
										week,
										(date) => date.toString(),
										(date) => RangeCalendarCell({ date, month }, RangeCalendarDay()),
									),
								),
						),
					),
				),
		),
	),
);
```

Ranges spanning several months read best with `numberOfMonths: 2` — the render function receives both months, and the nav buttons page past them.

## Value

The value is a `DateRange` — `{ start, end }` of `CalendarDate | null`. Pass an object to seed it, or a signal to control it from outside:

```ts
const value = signal<DateRange>({ start: null, end: null });

RangeCalendar({ value }, ({ months, weekdays }) => /* ... */);
```

The first click sets `start`; while the end is undecided, hovering (or arrowing) highlights the prospective span with `data-highlighted`. The second click sets `end` — clicking before the start swaps the two so the range always runs forward, and a write of an inverted range from outside is reordered the same way. With a complete range, the next click starts a new one; clicking the end date again clears the selection (unless `preventDeselect` is set).

`onValueChange` reports the range after every change, including the half-picked state where `end` is still `null`. `onRangeSelect` is the narrower hook: it runs only once both ends are in.

## Constraints

- `minDays` / `maxDays` bound the span's length. A pick outside the bounds restarts the selection at the clicked date.
- `excludeDisabled` clears any range that would contain a disabled date; while selecting, an invalid span simply doesn't highlight, and completing across one restarts at the clicked date.
- `minValue`, `maxValue`, `isDateDisabled`, and `isDateUnavailable` work exactly as on the calendar.

`onRangeSelect` runs whenever both ends become set.

## Keyboard, navigation, i18n

Identical to the [calendar](/primitives/docs/calendar): arrow keys move the focused day and page across months, Enter and Space select, prev/next buttons and the month/year selects navigate, and `locale` drives all formatting. Moving focus with the keyboard also drives the range highlight.

## Styling

Parts set `data-range-calendar-*` attributes (`data-range-calendar-root`, `data-range-calendar-day`, …). On top of the shared cell state (`data-selected`, `data-today`, `data-focused`, `data-outside-month`, `data-disabled`, `data-unavailable`, `data-value`), cells and days expose the range shape:

```ts
RangeCalendarDay({
	class:
		"size-8 data-selection-start:bg-primary data-selection-end:bg-primary data-range-middle:bg-accent data-highlighted:bg-accent",
});
```

- `data-selection-start` / `data-selection-end` mark the ends.
- `data-range-start` / `data-range-end` mark the visual edges even while the end is unset.
- `data-range-middle` marks days strictly inside a complete range.
- `data-highlighted` marks the prospective span under the pointer or keyboard focus.

## API Reference

<div data-api="range-calendar"></div>
