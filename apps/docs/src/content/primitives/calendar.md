---
title: Calendar
description: Pick a date from a month grid.
section: Components
---

<div data-demo="calendar"></div>

A calendar shows one or more months as a grid of days and owns which date is selected. `Calendar` is the root; instead of plain children it takes a render function, which receives the visible `months` and localized `weekdays` so you can lay out the grid yourself with [ForEach](/docs/foreach):

```ts
import {
	Calendar,
	CalendarCell,
	CalendarDay,
	CalendarGrid,
	CalendarGridBody,
	CalendarGridHead,
	CalendarGridRow,
	CalendarHeadCell,
	CalendarHeader,
	CalendarHeading,
	CalendarNextButton,
	CalendarPrevButton,
} from "@implementjs/primitives";
import { ForEach, Fragment } from "@implementjs/core";

Calendar({ calendarLabel: "Appointment date" }, ({ months, weekdays }) =>
	Fragment(
		CalendarHeader(CalendarPrevButton("←"), CalendarHeading(), CalendarNextButton("→")),
		ForEach(
			months,
			(month) => month.value.toString(),
			(month) =>
				CalendarGrid(
					CalendarGridHead(
						CalendarGridRow(
							ForEach(
								weekdays,
								(_, i) => i,
								(weekday) => CalendarHeadCell(weekday),
							),
						),
					),
					CalendarGridBody(
						ForEach(
							month.bind((m) => m.weeks),
							(week) => week[0].toString(),
							(week) =>
								CalendarGridRow(
									ForEach(
										week,
										(date) => date.toString(),
										(date) => CalendarCell({ date, month }, CalendarDay()),
									),
								),
						),
					),
				),
		),
	),
);
```

The grid renders real table elements — `CalendarGrid` is a `Table` with `role="grid"`, `CalendarCell` a `Td`, and so on — so the markup stays an accessible calendar table. `CalendarDay` renders the day number by default; pass children to replace it.

## Dates

Dates are plain values of the `CalendarDate` class the package exports — an immutable year/month/day with no time or time zone attached:

```ts
import { CalendarDate, today, parseDate } from "@implementjs/primitives";

const date = new CalendarDate(2026, 8, 20);
date.add({ months: 1 }); // a new CalendarDate; the original is untouched
date.toString(); // "2026-08-20"
parseDate("2026-08-20"); // back to a CalendarDate
today(); // the current local date
```

`add`, `subtract`, `set`, and `compare` cover the arithmetic a calendar needs, clamping days that would overflow a month (adding a month to January 31st lands on the last day of February). `isSameDay`, `isSameMonth`, `isBefore`, `isAfter`, and `isBetweenInclusive` are exported alongside.

## Value

`Calendar` owns the selected date. Pass a `CalendarDate` to seed it, or a [signal](/docs/signals) holding `CalendarDate | null` to control it from outside:

```ts
const value = signal<CalendarDate | null>(null);

Calendar({ value }, ({ months, weekdays }) => /* ... */);

value.set(new CalendarDate(2026, 12, 24)); // selects it and moves the view
```

Clicking a selected date clears it back to `null` unless `preventDeselect` is set. With `type: "multiple"` the value is a `Signal<CalendarDate[]>` instead, clicks toggle membership, and `maxDays` caps how many dates can be selected — exceeding it restarts the selection at the clicked date.

## Placeholder

The `placeholder` is the date the view starts on and keyboard focus follows; it is not a selection. Pass a signal to move the view programmatically — selecting a date, navigating, and arrowing across a month boundary all write it back.

## Navigation

`CalendarPrevButton` and `CalendarNextButton` page the view one month at a time — or by `numberOfMonths` when `pagedNavigation` is set — and disable themselves at `minValue`/`maxValue`. `CalendarMonthSelect` and `CalendarYearSelect` render native `select` elements that jump straight to a month or year:

```ts
CalendarHeader(CalendarMonthSelect(), CalendarYearSelect());
```

## Keyboard and focus

The focused day is the only Tab stop. Arrow keys move by one day horizontally and one week vertically, paging the calendar when focus crosses the visible months; Enter and Space select. Days disabled by `disableDaysOutsideMonth` (the default for days outside the month) or by `minValue`/`maxValue`/`isDateDisabled` are skipped.

## Disabled and unavailable dates

Three ways to rule dates out:

- `minValue` / `maxValue` bound the selectable window and disable the nav buttons at the edges.
- `isDateDisabled` disables matching dates entirely — not selectable, not focusable.
- `isDateUnavailable` marks dates that exist but can't be picked (a booked-out day): they stay focusable, get `data-unavailable`, and announce as disabled.

`disabled` on the root disables the whole calendar; `readonly` keeps the value visible but unchangeable.

## Internationalization

`locale` drives every formatted string — the heading, weekday names, and day labels — through `Intl.DateTimeFormat`. The week starts on the locale's first day where the runtime knows it, or Sunday; override with `weekStartsOn`. `weekdayFormat`, `monthFormat`, and `yearFormat` pick the `Intl` widths (or take a function).

## Accessibility

The root is a `role="application"` labeled by `calendarLabel` plus the visible month, and it renders a visually hidden heading announcing the same. Each day is a `role="button"` with a full date label ("Saturday, June 15, 2024"). Selections are announced through a polite live region.

## Styling

Every part sets a `data-calendar-*` attribute (`data-calendar-root`, `data-calendar-grid`, `data-calendar-day`, …). Cells and days additionally expose their state:

```ts
CalendarDay({
	class:
		"size-8 rounded-md data-selected:bg-primary data-today:bg-accent data-outside-month:text-muted-foreground data-disabled:opacity-50",
});
```

`data-selected`, `data-today`, `data-focused`, `data-outside-month`, `data-outside-visible-months`, `data-disabled`, and `data-unavailable` are present when they apply, and `data-value` holds the cell's ISO date.

## API Reference

<div data-api="calendar"></div>
