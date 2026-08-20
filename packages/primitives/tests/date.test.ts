import { describe, expect, it } from "vitest";
import {
	CalendarDate,
	createMonths,
	getDayOfWeek,
	isAfter,
	isBefore,
	isBetweenInclusive,
	isSameDay,
	isSameMonth,
	parseDate,
	today,
} from "../src/lib/components/helpers/date";

describe("CalendarDate", () => {
	it("clamps the day to the month's length", () => {
		expect(new CalendarDate(2024, 2, 31).day).toBe(29); // leap year
		expect(new CalendarDate(2023, 2, 31).day).toBe(28);
		expect(new CalendarDate(2024, 4, 31).day).toBe(30);
	});

	it("adds and subtracts days across month and year boundaries", () => {
		expect(new CalendarDate(2024, 1, 31).add({ days: 1 }).toString()).toBe("2024-02-01");
		expect(new CalendarDate(2024, 12, 31).add({ days: 1 }).toString()).toBe("2025-01-01");
		expect(new CalendarDate(2024, 3, 1).subtract({ days: 1 }).toString()).toBe("2024-02-29");
		expect(new CalendarDate(2024, 1, 1).subtract({ days: 1 }).toString()).toBe("2023-12-31");
	});

	it("adds months with day clamping", () => {
		expect(new CalendarDate(2024, 1, 31).add({ months: 1 }).toString()).toBe("2024-02-29");
		expect(new CalendarDate(2024, 11, 15).add({ months: 2 }).toString()).toBe("2025-01-15");
		expect(new CalendarDate(2024, 1, 15).subtract({ months: 2 }).toString()).toBe("2023-11-15");
	});

	it("adds years with leap-day clamping", () => {
		expect(new CalendarDate(2024, 2, 29).add({ years: 1 }).toString()).toBe("2025-02-28");
	});

	it("sets fields with clamping", () => {
		expect(new CalendarDate(2024, 1, 31).set({ month: 2 }).toString()).toBe("2024-02-29");
		expect(new CalendarDate(2024, 6, 10).set({ day: 35 }).day).toBe(30);
	});

	it("compares dates by day", () => {
		const a = new CalendarDate(2024, 5, 10);
		const b = new CalendarDate(2024, 5, 11);
		expect(a.compare(b)).toBeLessThan(0);
		expect(b.compare(a)).toBeGreaterThan(0);
		expect(a.compare(new CalendarDate(2024, 5, 10))).toBe(0);
		expect(isBefore(a, b)).toBe(true);
		expect(isAfter(b, a)).toBe(true);
		expect(isBetweenInclusive(a, a, b)).toBe(true);
	});

	it("round-trips through toString and parseDate", () => {
		const date = new CalendarDate(2024, 3, 7);
		expect(parseDate(date.toString()).compare(date)).toBe(0);
		expect(date.toString()).toBe("2024-03-07");
	});

	it("computes day of week", () => {
		expect(getDayOfWeek(new CalendarDate(1970, 1, 1))).toBe(4); // Thursday
		expect(getDayOfWeek(new CalendarDate(2024, 1, 1))).toBe(1); // Monday
		expect(getDayOfWeek(new CalendarDate(2024, 6, 30))).toBe(0); // Sunday
	});

	it("compares same day and month", () => {
		expect(isSameDay(new CalendarDate(2024, 5, 1), new CalendarDate(2024, 5, 1))).toBe(true);
		expect(isSameMonth(new CalendarDate(2024, 5, 1), new CalendarDate(2024, 5, 30))).toBe(true);
		expect(isSameMonth(new CalendarDate(2024, 5, 1), new CalendarDate(2023, 5, 1))).toBe(false);
	});

	it("today returns the current local date", () => {
		const now = new Date();
		const date = today();
		expect(date.year).toBe(now.getFullYear());
		expect(date.month).toBe(now.getMonth() + 1);
		expect(date.day).toBe(now.getDate());
	});
});

describe("createMonths", () => {
	it("builds full weeks around the month", () => {
		// June 2024: starts on Saturday, ends on Sunday
		const [month] = createMonths({
			dateObj: new CalendarDate(2024, 6, 15),
			weekStartsOn: 0,
			fixedWeeks: false,
			numberOfMonths: 1,
		});
		expect(month!.value.toString()).toBe("2024-06-01");
		expect(month!.weeks.length).toBe(6);
		expect(month!.dates[0]!.toString()).toBe("2024-05-26"); // Sunday before June 1st
		expect(month!.dates[month!.dates.length - 1]!.toString()).toBe("2024-07-06");
		for (const week of month!.weeks) expect(week.length).toBe(7);
	});

	it("respects weekStartsOn", () => {
		const [month] = createMonths({
			dateObj: new CalendarDate(2024, 6, 15),
			weekStartsOn: 1,
			fixedWeeks: false,
			numberOfMonths: 1,
		});
		expect(getDayOfWeek(month!.dates[0]!)).toBe(1); // Monday
		expect(month!.dates[0]!.toString()).toBe("2024-05-27");
	});

	it("pads to six weeks with fixedWeeks", () => {
		// February 2021 fits exactly four weeks starting Monday
		const [month] = createMonths({
			dateObj: new CalendarDate(2021, 2, 1),
			weekStartsOn: 1,
			fixedWeeks: true,
			numberOfMonths: 1,
		});
		expect(month!.dates.length).toBe(42);
		expect(month!.weeks.length).toBe(6);
	});

	it("builds consecutive months", () => {
		const months = createMonths({
			dateObj: new CalendarDate(2024, 11, 20),
			weekStartsOn: 0,
			fixedWeeks: false,
			numberOfMonths: 3,
		});
		expect(months.map((m) => m.value.toString())).toEqual([
			"2024-11-01",
			"2024-12-01",
			"2025-01-01",
		]);
	});
});
