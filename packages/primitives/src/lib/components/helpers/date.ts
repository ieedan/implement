/**
 * Dependency-free calendar date math for the calendar primitives.
 *
 * Ported from the pieces of `@internationalized/date` that bits-ui's calendar
 * uses, restricted to day granularity in the ISO (Gregorian) calendar.
 * Formatting goes through `Intl.DateTimeFormat`, so localized month, year, and
 * weekday names need no locale data of our own.
 */

export type DateDuration = {
	years?: number;
	months?: number;
	days?: number;
};

export type DateFields = {
	year?: number;
	month?: number;
	day?: number;
};

function daysInMonth(year: number, month: number): number {
	switch (month) {
		case 2:
			return isLeapYear(year) ? 29 : 28;
		case 4:
		case 6:
		case 9:
		case 11:
			return 30;
		default:
			return 31;
	}
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days since 1970-01-01, from Howard Hinnant's `days_from_civil` algorithm. */
function toEpochDays(year: number, month: number, day: number): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/** The inverse of {@link toEpochDays} (`civil_from_days`). */
function fromEpochDays(epochDays: number): CalendarDate {
	const z = epochDays + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
	);
	const y = yoe + era * 400;
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const month = mp + (mp < 10 ? 3 : -9);
	return new CalendarDate(month <= 2 ? y + 1 : y, month, day);
}

/** An immutable year/month/day in the ISO calendar. Month and day are 1-based. */
export class CalendarDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;

	constructor(year: number, month: number, day: number) {
		this.year = year;
		this.month = Math.min(Math.max(month, 1), 12);
		this.day = Math.min(Math.max(day, 1), daysInMonth(year, this.month));
	}

	/** Adds a duration, applying years, then months (clamping the day), then days. */
	add(duration: DateDuration): CalendarDate {
		let year = this.year + (duration.years ?? 0);
		let monthIndex = this.month - 1 + (duration.months ?? 0);
		year += Math.floor(monthIndex / 12);
		monthIndex = ((monthIndex % 12) + 12) % 12;
		const month = monthIndex + 1;
		const clamped = new CalendarDate(year, month, this.day);
		const days = duration.days ?? 0;
		if (days === 0) return clamped;
		return fromEpochDays(toEpochDays(clamped.year, clamped.month, clamped.day) + days);
	}

	subtract(duration: DateDuration): CalendarDate {
		return this.add({
			years: -(duration.years ?? 0),
			months: -(duration.months ?? 0),
			days: -(duration.days ?? 0),
		});
	}

	/** Replaces fields, clamping the day to the resulting month's length. */
	set(fields: DateFields): CalendarDate {
		return new CalendarDate(
			fields.year ?? this.year,
			fields.month ?? this.month,
			fields.day ?? this.day,
		);
	}

	/** Negative when this date is before `other`, positive when after, 0 when the same day. */
	compare(other: CalendarDate): number {
		return (
			toEpochDays(this.year, this.month, this.day) - toEpochDays(other.year, other.month, other.day)
		);
	}

	/** ISO 8601 (`YYYY-MM-DD`). */
	toString(): string {
		return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
	}

	/** Midnight of this date as a native `Date` in the runtime's local time zone. */
	toDate(): Date {
		const date = new Date(2000, 0, 1);
		date.setFullYear(this.year, this.month - 1, this.day);
		date.setHours(0, 0, 0, 0);
		return date;
	}
}

function pad(value: number, length: number): string {
	return String(value).padStart(length, "0");
}

/** Today in the runtime's local time zone. */
export function today(): CalendarDate {
	const now = new Date();
	return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Parses an ISO 8601 date string (`YYYY-MM-DD`). */
export function parseDate(value: string): CalendarDate {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) throw new Error(`Invalid ISO 8601 date: "${value}"`);
	return new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isSameMonth(a: CalendarDate, b: CalendarDate): boolean {
	return a.year === b.year && a.month === b.month;
}

export function isBefore(date: CalendarDate, reference: CalendarDate): boolean {
	return date.compare(reference) < 0;
}

export function isAfter(date: CalendarDate, reference: CalendarDate): boolean {
	return date.compare(reference) > 0;
}

export function isBetweenInclusive(
	date: CalendarDate,
	start: CalendarDate,
	end: CalendarDate,
): boolean {
	return date.compare(start) >= 0 && date.compare(end) <= 0;
}

/** Day of the week, 0–6, where 0 is Sunday. */
export function getDayOfWeek(date: CalendarDate): number {
	const epochDays = toEpochDays(date.year, date.month, date.day);
	// 1970-01-01 was a Thursday (4).
	return (((epochDays + 4) % 7) + 7) % 7;
}

/** 0–6 day the week starts on (0 = Sunday) for a locale; 0 when the runtime can't say. */
export function getLocaleWeekStart(locale: string): number {
	try {
		const resolved = new Intl.Locale(locale) as Intl.Locale & {
			getWeekInfo?: () => { firstDay: number };
			weekInfo?: { firstDay: number };
		};
		// firstDay is 1–7 where 1 is Monday and 7 is Sunday
		const firstDay = resolved.getWeekInfo?.().firstDay ?? resolved.weekInfo?.firstDay;
		if (firstDay === undefined) return 0;
		return firstDay % 7;
	} catch {
		return 0;
	}
}

/** One rendered month: its first day, every visible date, and those dates chunked into weeks. */
export type Month = {
	/** The first day of the month. */
	value: CalendarDate;
	/** Every date in the visible grid, including leading and trailing outside days. */
	dates: CalendarDate[];
	/** `dates` chunked into rows of seven. */
	weeks: CalendarDate[][];
};

type CreateMonthOptions = {
	dateObj: CalendarDate;
	weekStartsOn: number;
	fixedWeeks: boolean;
};

function createMonth({ dateObj, weekStartsOn, fixedWeeks }: CreateMonthOptions): Month {
	const firstDay = dateObj.set({ day: 1 });
	const lastDay = dateObj.set({ day: daysInMonth(dateObj.year, dateObj.month) });

	// back up to the week start on or before the 1st
	const leading = (getDayOfWeek(firstDay) - weekStartsOn + 7) % 7;
	let current = firstDay.subtract({ days: leading });

	const trailing = 6 - ((getDayOfWeek(lastDay) - weekStartsOn + 7) % 7);
	const end = lastDay.add({ days: trailing });

	const dates: CalendarDate[] = [];
	while (current.compare(end) <= 0) {
		dates.push(current);
		current = current.add({ days: 1 });
	}

	if (fixedWeeks) {
		while (dates.length < 42) {
			const last = dates[dates.length - 1]!;
			dates.push(last.add({ days: 1 }));
		}
	}

	const weeks: CalendarDate[][] = [];
	for (let i = 0; i < dates.length; i += 7) {
		weeks.push(dates.slice(i, i + 7));
	}

	return { value: firstDay, dates, weeks };
}

export type CreateMonthsOptions = CreateMonthOptions & {
	numberOfMonths: number;
};

/** Builds the visible months starting from `dateObj`'s month. */
export function createMonths({ numberOfMonths, dateObj, ...rest }: CreateMonthsOptions): Month[] {
	const months: Month[] = [];
	for (let i = 0; i < Math.max(numberOfMonths, 1); i++) {
		months.push(createMonth({ ...rest, dateObj: dateObj.add({ months: i }) }));
	}
	return months;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats a `CalendarDate` through a cached `Intl.DateTimeFormat`. Dates are
 * formatted in UTC from their UTC-midnight instant, so the local time zone
 * never shifts the rendered day.
 */
export function formatDate(
	date: CalendarDate,
	locale: string,
	options: Intl.DateTimeFormatOptions,
): string {
	const key = `${locale}|${JSON.stringify(options)}`;
	let formatter = formatterCache.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
		formatterCache.set(key, formatter);
	}
	return formatter.format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}
