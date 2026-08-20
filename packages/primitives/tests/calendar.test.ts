// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, ForEach, Fragment, signal } from "@implementjs/core";
import {
	Calendar,
	CalendarCell,
	CalendarDate,
	CalendarDay,
	CalendarGrid,
	CalendarGridBody,
	CalendarGridHead,
	CalendarGridRow,
	CalendarHeadCell,
	CalendarHeader,
	CalendarHeading,
	CalendarMonthSelect,
	CalendarNextButton,
	CalendarPrevButton,
	CalendarYearSelect,
	type CalendarRootProps,
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

function TestCalendar(props: CalendarRootProps | CalendarRootProps<"multiple">) {
	return Calendar(props, ({ months, weekdays }) =>
		Fragment(
			CalendarHeader(
				{},
				CalendarPrevButton({}, "prev"),
				CalendarHeading({}),
				CalendarNextButton({}, "next"),
			),
			ForEach(
				months,
				(month) => month.value.toString(),
				(month) =>
					CalendarGrid(
						{},
						CalendarGridHead(
							{},
							CalendarGridRow(
								{},
								ForEach(
									weekdays,
									(_, i) => i,
									(weekday) => CalendarHeadCell({}, weekday),
								),
							),
						),
						CalendarGridBody(
							{},
							ForEach(
								month.bind((m) => m.weeks),
								(week) => week[0]!.toString(),
								(week) =>
									CalendarGridRow(
										{},
										ForEach(
											week,
											(date) => date.toString(),
											(date) => CalendarCell({ date, month }, CalendarDay({})),
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
		`[data-calendar-day][data-value="${value}"]:not([data-outside-month])`,
	);
	if (!node) throw new Error(`No day node for ${value}`);
	return node;
}

describe("Calendar", () => {
	it("renders the placeholder month with weekday headers and a heading", async () => {
		const { target, unmount } = await mount(
			TestCalendar({ placeholder: new CalendarDate(2024, 6, 15), locale: "en-US" }),
		);

		expect(target.querySelector("[data-calendar-root]")).not.toBeNull();
		const heading = target.querySelector("[data-calendar-heading]");
		expect(heading?.textContent).toBe("June 2024");
		expect(target.querySelectorAll("[data-calendar-head-cell]").length).toBe(7);
		expect(target.querySelectorAll("[data-calendar-day]:not([data-outside-month])").length).toBe(
			30,
		);
		unmount();
	});

	it("selects a date on click and deselects on a second click", async () => {
		const value = signal<CalendarDate | null>(null);
		const { target, unmount } = await mount(
			TestCalendar({ value, placeholder: new CalendarDate(2024, 6, 15) }),
		);

		day(target, "2024-06-10").click();
		expect(value.get()?.toString()).toBe("2024-06-10");
		expect(day(target, "2024-06-10").getAttribute("data-selected")).toBe("");

		day(target, "2024-06-10").click();
		expect(value.get()).toBeNull();
		unmount();
	});

	it("keeps the selection when preventDeselect is set", async () => {
		const value = signal<CalendarDate | null>(null);
		const { target, unmount } = await mount(
			TestCalendar({ value, placeholder: new CalendarDate(2024, 6, 15), preventDeselect: true }),
		);

		day(target, "2024-06-10").click();
		day(target, "2024-06-10").click();
		expect(value.get()?.toString()).toBe("2024-06-10");
		unmount();
	});

	it("navigates months with the prev and next buttons", async () => {
		const { target, unmount } = await mount(
			TestCalendar({ placeholder: new CalendarDate(2024, 6, 15) }),
		);
		const heading = target.querySelector("[data-calendar-heading]")!;

		target.querySelector<HTMLElement>("[data-calendar-next-button]")!.click();
		expect(heading.textContent).toBe("July 2024");
		target.querySelector<HTMLElement>("[data-calendar-prev-button]")!.click();
		target.querySelector<HTMLElement>("[data-calendar-prev-button]")!.click();
		expect(heading.textContent).toBe("May 2024");
		unmount();
	});

	it("disables dates outside minValue/maxValue and the nav buttons at the bounds", async () => {
		const { target, unmount } = await mount(
			TestCalendar({
				placeholder: new CalendarDate(2024, 6, 15),
				minValue: new CalendarDate(2024, 6, 5),
				maxValue: new CalendarDate(2024, 6, 20),
			}),
		);

		expect(day(target, "2024-06-04").getAttribute("data-disabled")).toBe("");
		expect(day(target, "2024-06-05").getAttribute("data-disabled")).toBeNull();
		expect(day(target, "2024-06-21").getAttribute("data-disabled")).toBe("");
		expect(target.querySelector("[data-calendar-prev-button]")!.hasAttribute("disabled")).toBe(
			true,
		);
		expect(target.querySelector("[data-calendar-next-button]")!.hasAttribute("disabled")).toBe(
			true,
		);
		unmount();
	});

	it("moves focus with arrow keys and pages across month boundaries", async () => {
		const { target, unmount } = await mount(
			TestCalendar({ placeholder: new CalendarDate(2024, 6, 15) }),
		);

		const start = day(target, "2024-06-15");
		expect(start.getAttribute("tabindex")).toBe("0");
		start.focus();
		start.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(day(target, "2024-06-16").getAttribute("data-focused")).toBe("");
		expect(day(target, "2024-06-16").getAttribute("tabindex")).toBe("0");

		day(target, "2024-06-16").dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
		);
		expect(day(target, "2024-06-23").getAttribute("data-focused")).toBe("");

		// arrow past the end of the month pages forward
		const heading = target.querySelector("[data-calendar-heading]")!;
		for (let i = 0; i < 2; i++) {
			target
				.querySelector<HTMLElement>("[data-calendar-day][data-focused]")!
				.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		}
		expect(heading.textContent).toBe("July 2024");
		expect(day(target, "2024-07-07").getAttribute("data-focused")).toBe("");
		unmount();
	});

	it("selects the focused day with Enter", async () => {
		const value = signal<CalendarDate | null>(null);
		const { target, unmount } = await mount(
			TestCalendar({ value, placeholder: new CalendarDate(2024, 6, 15) }),
		);

		day(target, "2024-06-15").dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		expect(value.get()?.toString()).toBe("2024-06-15");
		unmount();
	});

	it("supports multiple selection with a maxDays reset", async () => {
		const value = signal<CalendarDate[]>([]);
		const { target, unmount } = await mount(
			TestCalendar({
				type: "multiple",
				value,
				maxDays: 2,
				placeholder: new CalendarDate(2024, 6, 15),
			}),
		);

		day(target, "2024-06-03").click();
		day(target, "2024-06-05").click();
		expect(value.get().map(String)).toEqual(["2024-06-03", "2024-06-05"]);

		// exceeding maxDays resets to the new date
		day(target, "2024-06-07").click();
		expect(value.get().map(String)).toEqual(["2024-06-07"]);

		// clicking a selected date removes it
		day(target, "2024-06-07").click();
		expect(value.get()).toEqual([]);
		unmount();
	});

	it("marks unavailable dates but keeps them focusable", async () => {
		const value = signal<CalendarDate | null>(null);
		const { target, unmount } = await mount(
			TestCalendar({
				value,
				placeholder: new CalendarDate(2024, 6, 15),
				isDateUnavailable: (date) => date.day === 13,
			}),
		);

		const unavailable = day(target, "2024-06-13");
		expect(unavailable.getAttribute("data-unavailable")).toBe("");
		expect(unavailable.getAttribute("aria-disabled")).toBe("true");
		unavailable.click();
		expect(value.get()).toBeNull();
		unmount();
	});

	it("moves the view when the value is written from outside", async () => {
		const value = signal<CalendarDate | null>(null);
		const { target, unmount } = await mount(
			TestCalendar({ value, placeholder: new CalendarDate(2024, 6, 15) }),
		);

		value.set(new CalendarDate(2025, 2, 14));
		const heading = target.querySelector("[data-calendar-heading]")!;
		expect(heading.textContent).toBe("February 2025");
		expect(day(target, "2025-02-14").getAttribute("data-selected")).toBe("");
		unmount();
	});

	it("jumps to a month and year through the native selects", async () => {
		const { target, unmount } = await mount(
			Calendar({ placeholder: new CalendarDate(2024, 6, 15) }, () =>
				Fragment(CalendarHeading({}), CalendarMonthSelect({}), CalendarYearSelect({})),
			),
		);

		const monthSelect = target.querySelector<HTMLSelectElement>("[data-calendar-month-select]")!;
		expect(monthSelect.querySelectorAll("option").length).toBe(12);
		expect(monthSelect.querySelector<HTMLOptionElement>("option[value='6']")!.selected).toBe(true);

		monthSelect.value = "2";
		monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
		expect(target.querySelector("[data-calendar-heading]")!.textContent).toBe("February 2024");

		const yearSelect = target.querySelector<HTMLSelectElement>("[data-calendar-year-select]")!;
		yearSelect.value = "2030";
		yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
		expect(target.querySelector("[data-calendar-heading]")!.textContent).toBe("February 2030");
		unmount();
	});

	it("marks today and days outside the month", async () => {
		const now = new Date();
		const placeholder = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
		const { target, unmount } = await mount(TestCalendar({ placeholder }));

		expect(day(target, placeholder.toString()).getAttribute("data-today")).toBe("");
		expect(
			target.querySelectorAll("[data-calendar-day][data-outside-month][data-disabled]").length,
		).toBeGreaterThan(0);
		unmount();
	});
});
