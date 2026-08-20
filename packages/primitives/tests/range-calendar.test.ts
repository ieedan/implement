// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, ForEach, Fragment, signal } from "@implementjs/core";
import {
	CalendarDate,
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
	type DateRange,
	type RangeCalendarRootProps,
} from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(tree);
	await tick();
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

function TestRangeCalendar(props: RangeCalendarRootProps) {
	return RangeCalendar(props, ({ months, weekdays }) =>
		Fragment(
			RangeCalendarHeader(
				{},
				RangeCalendarPrevButton({}, "prev"),
				RangeCalendarHeading({}),
				RangeCalendarNextButton({}, "next"),
			),
			ForEach(
				months,
				(month) => month.value.toString(),
				(month) =>
					RangeCalendarGrid(
						{},
						RangeCalendarGridHead(
							{},
							RangeCalendarGridRow(
								{},
								ForEach(
									weekdays,
									(_, i) => i,
									(weekday) => RangeCalendarHeadCell({}, weekday),
								),
							),
						),
						RangeCalendarGridBody(
							{},
							ForEach(
								month.bind((m) => m.weeks),
								(week) => week[0]!.toString(),
								(week) =>
									RangeCalendarGridRow(
										{},
										ForEach(
											week,
											(date) => date.toString(),
											(date) => RangeCalendarCell({ date, month }, RangeCalendarDay({})),
										),
									),
							),
						),
					),
			),
		),
	);
}

function day(target: HTMLElement, value: string): HTMLElement {
	const node = target.querySelector<HTMLElement>(
		`[data-range-calendar-day][data-value="${value}"]:not([data-outside-month])`,
	);
	if (!node) throw new Error(`No day node for ${value}`);
	return node;
}

const june = (dayOfMonth: number) => new CalendarDate(2024, 6, dayOfMonth);

describe("RangeCalendar", () => {
	it("renders with the range calendar data attributes", async () => {
		const { target, unmount } = await mount(
			TestRangeCalendar({ placeholder: june(15), locale: "en-US" }),
		);
		expect(target.querySelector("[data-range-calendar-root]")).not.toBeNull();
		expect(target.querySelector("[data-range-calendar-heading]")?.textContent).toBe("June 2024");
		unmount();
	});

	it("selects a range across two clicks", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(TestRangeCalendar({ value, placeholder: june(15) }));

		day(target, "2024-06-05").click();
		expect(value.get().start?.toString()).toBe("2024-06-05");
		expect(value.get().end).toBeNull();

		day(target, "2024-06-10").click();
		expect(value.get().start?.toString()).toBe("2024-06-05");
		expect(value.get().end?.toString()).toBe("2024-06-10");

		expect(day(target, "2024-06-05").getAttribute("data-selection-start")).toBe("");
		expect(day(target, "2024-06-10").getAttribute("data-selection-end")).toBe("");
		expect(day(target, "2024-06-07").getAttribute("data-range-middle")).toBe("");
		expect(day(target, "2024-06-07").getAttribute("data-selected")).toBe("");
		unmount();
	});

	it("orders a backward selection", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(TestRangeCalendar({ value, placeholder: june(15) }));

		day(target, "2024-06-20").click();
		day(target, "2024-06-12").click();
		expect(value.get().start?.toString()).toBe("2024-06-12");
		expect(value.get().end?.toString()).toBe("2024-06-20");
		unmount();
	});

	it("restarts the selection when a complete range exists", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(TestRangeCalendar({ value, placeholder: june(15) }));

		day(target, "2024-06-05").click();
		day(target, "2024-06-10").click();
		day(target, "2024-06-20").click();
		expect(value.get().start?.toString()).toBe("2024-06-20");
		expect(value.get().end).toBeNull();
		unmount();
	});

	it("clears the range when the end date is clicked again", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(TestRangeCalendar({ value, placeholder: june(15) }));

		day(target, "2024-06-05").click();
		day(target, "2024-06-10").click();
		day(target, "2024-06-10").click();
		expect(value.get()).toEqual({ start: null, end: null });
		unmount();
	});

	it("highlights the hovered span before the end is picked", async () => {
		const { target, unmount } = await mount(TestRangeCalendar({ placeholder: june(15) }));

		day(target, "2024-06-05").click();
		day(target, "2024-06-08").dispatchEvent(new Event("mouseenter"));
		expect(day(target, "2024-06-06").getAttribute("data-highlighted")).toBe("");
		expect(day(target, "2024-06-08").getAttribute("data-highlighted")).toBe("");
		expect(day(target, "2024-06-09").getAttribute("data-highlighted")).toBeNull();
		unmount();
	});

	it("restarts on picks shorter than minDays or longer than maxDays", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(
			TestRangeCalendar({ value, placeholder: june(15), minDays: 3, maxDays: 5 }),
		);

		day(target, "2024-06-05").click();
		day(target, "2024-06-06").click(); // 2 days < minDays
		expect(value.get().start?.toString()).toBe("2024-06-06");
		expect(value.get().end).toBeNull();

		day(target, "2024-06-12").click(); // 7 days > maxDays
		expect(value.get().start?.toString()).toBe("2024-06-12");
		expect(value.get().end).toBeNull();

		day(target, "2024-06-14").click(); // 3 days, valid
		expect(value.get().end?.toString()).toBe("2024-06-14");
		unmount();
	});

	it("clears a range containing a disabled date when excludeDisabled is set", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { target, unmount } = await mount(
			TestRangeCalendar({
				value,
				placeholder: june(15),
				excludeDisabled: true,
				isDateDisabled: (date) => date.day === 8,
			}),
		);

		// picking across the disabled day restarts at the clicked date
		day(target, "2024-06-05").click();
		day(target, "2024-06-10").click();
		expect(value.get().start?.toString()).toBe("2024-06-10");
		expect(value.get().end).toBeNull();

		// a complete range written from outside is cleared
		value.set({ start: june(5), end: june(10) });
		expect(value.get()).toEqual({ start: null, end: null });
		unmount();
	});

	it("reorders an inverted range written from outside", async () => {
		const value = signal<DateRange>({ start: null, end: null });
		const { unmount } = await mount(TestRangeCalendar({ value, placeholder: june(15) }));

		value.set({ start: june(20), end: june(10) });
		expect(value.get().start?.toString()).toBe("2024-06-10");
		expect(value.get().end?.toString()).toBe("2024-06-20");
		unmount();
	});

	it("runs onRangeSelect when the range completes", async () => {
		let calls = 0;
		const { target, unmount } = await mount(
			TestRangeCalendar({ placeholder: june(15), onRangeSelect: () => calls++ }),
		);

		day(target, "2024-06-05").click();
		expect(calls).toBe(0);
		day(target, "2024-06-10").click();
		expect(calls).toBe(1);
		unmount();
	});
});
