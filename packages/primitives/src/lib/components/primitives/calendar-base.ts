import {
	Button,
	context,
	derived,
	Div,
	ForEach,
	Implement,
	Option,
	ref,
	Select as SelectElement,
	signal,
	Table,
	Tbody,
	Th,
	Thead,
	Tr,
	watch,
	type Child,
	type ComponentProps,
	type Readable,
	type Ref,
	type Signal,
	type Styles,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import {
	CalendarDate,
	createMonths,
	formatDate,
	getLocaleWeekStart,
	isAfter,
	isBefore,
	isSameDay,
	isSameMonth,
	parseDate,
	today,
	type Month,
} from "../helpers/date";

export type CalendarVariant = "calendar" | "range-calendar";

export type WeekdayFormat = "narrow" | "short" | "long";

export type MonthFormat = Intl.DateTimeFormatOptions["month"] | ((month: number) => string);

export type YearFormat = Intl.DateTimeFormatOptions["year"] | ((year: number) => string);

/** The values the root hands to its children render function. */
export type CalendarRenderProps = {
	/** The visible months. Navigation replaces the array. */
	months: Readable<Month[]>;
	/** Localized weekday names for the grid's head row, in render order. */
	weekdays: Readable<string[]>;
};

/** The props both calendar roots share. */
export type CalendarBaseOptions = {
	/** The earliest selectable date. Earlier dates are disabled. */
	minValue?: CalendarDate;
	/** The latest selectable date. Later dates are disabled. */
	maxValue?: CalendarDate;
	/** Marks individual dates as disabled: not selectable and skipped by the keyboard. */
	isDateDisabled?: (date: CalendarDate) => boolean;
	/** Marks individual dates as unavailable: rendered and focusable but not selectable. */
	isDateUnavailable?: (date: CalendarDate) => boolean;
	/** Whether a selected date can be deselected by clicking it again. */
	preventDeselect?: boolean;
	/** Always render six weeks per month so the grid height never changes. */
	fixedWeeks?: boolean;
	/** How many consecutive months are rendered. */
	numberOfMonths?: number;
	/** Whether prev/next move by `numberOfMonths` months instead of one. */
	pagedNavigation?: boolean;
	/** The day the week starts on, 0–6 where 0 is Sunday. Defaults to the locale's week start. */
	weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	/** The `Intl` width of the weekday names provided to the render function. */
	weekdayFormat?: WeekdayFormat;
	/** Whether days outside the current month are disabled. */
	disableDaysOutsideMonth?: boolean;
	/** BCP 47 locale tag used for all formatting. */
	locale?: string;
	/** Prefixed onto the heading to label the calendar for assistive technology. */
	calendarLabel?: string;
	/** How the heading and month select format month names. */
	monthFormat?: MonthFormat;
	/** How the heading and year select format years. */
	yearFormat?: YearFormat;
};

type ResolvedBaseOptions = Required<
	Omit<CalendarBaseOptions, "minValue" | "maxValue" | "weekStartsOn">
> &
	Pick<CalendarBaseOptions, "minValue" | "maxValue"> & { weekStartsOn: number };

export function resolveBaseOptions(opts: CalendarBaseOptions): ResolvedBaseOptions {
	const locale = opts.locale ?? "en-US";
	return {
		minValue: opts.minValue,
		maxValue: opts.maxValue,
		isDateDisabled: opts.isDateDisabled ?? (() => false),
		isDateUnavailable: opts.isDateUnavailable ?? (() => false),
		preventDeselect: opts.preventDeselect ?? false,
		fixedWeeks: opts.fixedWeeks ?? false,
		numberOfMonths: opts.numberOfMonths ?? 1,
		pagedNavigation: opts.pagedNavigation ?? false,
		weekStartsOn: opts.weekStartsOn ?? getLocaleWeekStart(locale),
		weekdayFormat: opts.weekdayFormat ?? "narrow",
		disableDaysOutsideMonth: opts.disableDaysOutsideMonth ?? true,
		locale,
		calendarLabel: opts.calendarLabel ?? "Event",
		monthFormat: opts.monthFormat ?? "long",
		yearFormat: opts.yearFormat ?? "numeric",
	};
}

/** Clamp the starting placeholder into the `minValue`/`maxValue` window. */
export function defaultPlaceholder(minValue?: CalendarDate, maxValue?: CalendarDate): CalendarDate {
	let date = today();
	if (minValue && isBefore(date, minValue)) date = minValue;
	else if (maxValue && isAfter(date, maxValue)) date = maxValue;
	return date;
}

/**
 * Announces selection changes to assistive technology through a shared
 * `aria-live` region appended to the body.
 */
export function announce(message: string) {
	if (typeof document === "undefined") return;
	let region = document.getElementById("ip-announcer");
	if (!region) {
		region = document.createElement("div");
		region.id = "ip-announcer";
		region.setAttribute("aria-live", "polite");
		region.style.cssText =
			"position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
		document.body.appendChild(region);
	}
	const item = document.createElement("div");
	item.textContent = message;
	region.appendChild(item);
	setTimeout(() => item.remove(), 7500);
}

const DAY_ATTR = "data-ip-day";

export abstract class CalendarBaseState {
	readonly opts: ResolvedBaseOptions;
	readonly placeholder: Signal<CalendarDate>;
	readonly months: Signal<Month[]>;
	readonly disabled: Signal<boolean>;
	readonly readonly: Signal<boolean>;
	readonly root: Ref<HTMLDivElement> = ref();
	readonly headingId = getId();
	readonly initialPlaceholder: CalendarDate;
	readonly weekdays: Readable<string[]>;
	readonly headingValue: Readable<string>;
	readonly fullCalendarLabel: Readable<string>;
	readonly isPrevButtonDisabled: Readable<boolean>;
	readonly isNextButtonDisabled: Readable<boolean>;
	protected readonly unsubscribers: (() => void)[] = [];

	constructor(
		readonly variant: CalendarVariant,
		opts: CalendarBaseOptions,
		placeholder: Signal<CalendarDate> | CalendarDate | undefined,
		disabled: Signal<boolean> | boolean,
		readonly_: Signal<boolean> | boolean,
	) {
		this.opts = resolveBaseOptions(opts);
		this.placeholder = signal(
			placeholder ?? defaultPlaceholder(this.opts.minValue, this.opts.maxValue),
		);
		this.initialPlaceholder = this.placeholder.get();
		this.disabled = signal(disabled);
		this.readonly = signal(readonly_);
		this.months = signal(this.createMonths(this.placeholder.get()));

		// re-derive the grid when navigation or an external write moves the
		// placeholder out of the visible months
		this.unsubscribers.push(
			watch([this.placeholder], (date) => {
				if (this.months.get().some((month) => isSameMonth(month.value, date))) return;
				this.months.set(this.createMonths(date));
			}),
		);

		this.weekdays = derived([this.months], (months) => {
			const firstWeek = months[0]?.weeks[0];
			if (!firstWeek) return [];
			return firstWeek.map((date) =>
				formatDate(date, this.opts.locale, { weekday: this.opts.weekdayFormat }),
			);
		});

		this.headingValue = derived([this.months], (months) => this.formatHeading(months));
		this.fullCalendarLabel = this.headingValue.bind(
			(heading) => `${this.opts.calendarLabel} ${heading}`,
		);

		this.isPrevButtonDisabled = derived([this.months, this.disabled], (months, disabled) => {
			if (disabled) return true;
			const minValue = this.opts.minValue;
			const firstMonth = months[0]?.value;
			if (!minValue || !firstMonth) return false;
			// the last day of the previous page must still be reachable
			const lastDayOfPrevPage = firstMonth.subtract({ months: 1 }).set({ day: 35 });
			return isBefore(lastDayOfPrevPage, minValue);
		});

		this.isNextButtonDisabled = derived([this.months, this.disabled], (months, disabled) => {
			if (disabled) return true;
			const maxValue = this.opts.maxValue;
			const lastMonth = months[months.length - 1]?.value;
			if (!maxValue || !lastMonth) return false;
			const firstDayOfNextPage = lastMonth.add({ months: 1 }).set({ day: 1 });
			return isAfter(firstDayOfNextPage, maxValue);
		});
	}

	/** The reactive sources a day's state depends on beyond the shared ones. */
	abstract selectionSources(): readonly Readable<any>[];

	abstract isDateSelected(date: CalendarDate): boolean;

	abstract isInvalid(): Readable<boolean>;

	abstract handleCellClick(e: Event, date: CalendarDate): void;

	dispose() {
		for (const unsubscribe of this.unsubscribers) unsubscribe();
	}

	protected createMonths(date: CalendarDate): Month[] {
		return createMonths({
			dateObj: date,
			weekStartsOn: this.opts.weekStartsOn,
			fixedWeeks: this.opts.fixedWeeks,
			numberOfMonths: this.opts.numberOfMonths,
		});
	}

	attr(part: string): string {
		return `data-${this.variant}-${part}`;
	}

	formatMonth(date: CalendarDate): string {
		const monthFormat = this.opts.monthFormat;
		if (typeof monthFormat === "function") return monthFormat(date.month);
		return formatDate(date, this.opts.locale, { month: monthFormat });
	}

	formatYear(date: CalendarDate): string {
		const yearFormat = this.opts.yearFormat;
		if (typeof yearFormat === "function") return yearFormat(date.year);
		return formatDate(date, this.opts.locale, { year: yearFormat });
	}

	private formatHeading(months: Month[]): string {
		if (!months.length) return "";
		const first = months[0]!.value;
		if (months.length === 1) return `${this.formatMonth(first)} ${this.formatYear(first)}`;
		const last = months[months.length - 1]!.value;
		const firstYear = this.formatYear(first);
		const lastYear = this.formatYear(last);
		return firstYear === lastYear
			? `${this.formatMonth(first)} - ${this.formatMonth(last)} ${lastYear}`
			: `${this.formatMonth(first)} ${firstYear} - ${this.formatMonth(last)} ${lastYear}`;
	}

	isDateDisabled(date: CalendarDate): boolean {
		if (this.opts.isDateDisabled(date) || this.disabled.get()) return true;
		if (this.opts.minValue && isBefore(date, this.opts.minValue)) return true;
		if (this.opts.maxValue && isAfter(date, this.opts.maxValue)) return true;
		return false;
	}

	isDateUnavailable(date: CalendarDate): boolean {
		return this.opts.isDateUnavailable(date);
	}

	isOutsideVisibleMonths(date: CalendarDate): boolean {
		return !this.months.get().some((month) => isSameMonth(date, month.value));
	}

	nextPage() {
		this.page(1);
	}

	prevPage() {
		this.page(-1);
	}

	private page(direction: 1 | -1) {
		const firstMonth = this.months.get()[0]?.value;
		if (!firstMonth) return;
		const step = this.opts.pagedNavigation ? this.opts.numberOfMonths : 1;
		const target = firstMonth.add({ months: direction * step });
		// set the months before the placeholder so the placeholder watcher sees
		// its month already visible and doesn't re-derive the grid
		this.months.set(this.createMonths(target));
		this.placeholder.set(target);
	}

	nextYear() {
		this.placeholder.set(this.placeholder.get().add({ years: 1 }));
	}

	prevYear() {
		this.placeholder.set(this.placeholder.get().subtract({ years: 1 }));
	}

	setMonth(month: number) {
		this.placeholder.set(this.placeholder.get().set({ month }));
	}

	setYear(year: number) {
		this.placeholder.set(this.placeholder.get().set({ year }));
	}

	/**
	 * If the initial placeholder is a disabled date nothing would be tabbable
	 * and the calendar couldn't be entered with the keyboard; move it to the
	 * first selectable visible day.
	 */
	ensureNonDisabledPlaceholder() {
		const placeholder = this.placeholder.get();
		if (!isSameDay(placeholder, this.initialPlaceholder)) return;
		if (!this.isDateDisabled(placeholder) && !this.isDateUnavailable(placeholder)) return;
		for (const month of this.months.get()) {
			for (const date of month.dates) {
				if (!isSameMonth(date, month.value)) continue;
				if (this.isDateDisabled(date) || this.isDateUnavailable(date)) continue;
				this.placeholder.set(date);
				return;
			}
		}
	}

	private selectableCells(): HTMLElement[] {
		const root = this.root.get();
		if (!root) return [];
		return Array.from(
			root.querySelectorAll<HTMLElement>(
				`[${DAY_ATTR}]:not([data-disabled]):not([data-outside-visible-months])`,
			),
		);
	}

	/** Moves focus `add` days from `node`, paging the calendar when the target is off screen. */
	shiftFocus(node: HTMLElement, add: number) {
		const cells = this.selectableCells();
		if (!cells.length) return;
		const index = cells.indexOf(node);
		const nextIndex = index + add;

		if (nextIndex >= 0 && nextIndex < cells.length) {
			const nextCell = cells[nextIndex]!;
			this.setPlaceholderToNode(nextCell);
			nextCell.focus();
			return;
		}

		if (nextIndex < 0) {
			if (this.isPrevButtonDisabled.get()) return;
			const firstMonth = this.months.get()[0]?.value;
			if (!firstMonth) return;
			this.placeholder.set(firstMonth.subtract({ months: this.opts.numberOfMonths }));
			// signal updates are synchronous, so the new cells are already mounted
			const newCells = this.selectableCells();
			if (!newCells.length) return;
			const newIndex = newCells.length - Math.abs(nextIndex);
			const newCell = newCells[newIndex];
			if (!newCell) return;
			this.setPlaceholderToNode(newCell);
			newCell.focus();
			return;
		}

		if (this.isNextButtonDisabled.get()) return;
		const firstMonth = this.months.get()[0]?.value;
		if (!firstMonth) return;
		this.placeholder.set(firstMonth.add({ months: this.opts.numberOfMonths }));
		const newCells = this.selectableCells();
		if (!newCells.length) return;
		const newCell = newCells[nextIndex - cells.length];
		if (!newCell) return;
		this.setPlaceholderToNode(newCell);
		newCell.focus();
	}

	private setPlaceholderToNode(node: HTMLElement) {
		const value = node.getAttribute("data-value");
		if (!value) return;
		this.placeholder.set(parseDate(value));
	}

	onKeydown(e: KeyboardEvent) {
		const target = e.target;
		if (!(target instanceof HTMLElement) || !target.hasAttribute(DAY_ATTR)) return;
		const moves: Record<string, number> = {
			ArrowDown: 7,
			ArrowUp: -7,
			ArrowLeft: -1,
			ArrowRight: 1,
		};
		if (e.key in moves) {
			e.preventDefault();
			this.shiftFocus(target, moves[e.key]!);
			return;
		}
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			const value = target.getAttribute("data-value");
			if (!value) return;
			this.handleCellClick(e, parseDate(value));
		}
	}
}

export const CalendarBaseCtx = context<CalendarBaseState>();

const VISUALLY_HIDDEN: Styles = {
	border: "0",
	clip: "rect(0 0 0 0)",
	clipPath: "inset(50%)",
	height: "1px",
	margin: "-1px",
	overflow: "hidden",
	padding: "0",
	position: "absolute",
	whiteSpace: "nowrap",
	width: "1px",
};

/** The visually hidden `role="heading"` that labels the calendar for assistive technology. */
export function CalendarAccessibleHeading(state: CalendarBaseState): Child {
	return Div(
		{ style: VISUALLY_HIDDEN },
		Div({ id: state.headingId, role: "heading", "aria-level": 2 }, state.fullCalendarLabel),
	);
}

export type CalendarHeaderProps = ComponentProps<typeof Div>;

export function CalendarHeader(
	{ id = getId(), ...restProps }: CalendarHeaderProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Div(
			mergeProps(
				{
					id,
					[state.attr("header")]: "",
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarHeadingProps = ComponentProps<typeof Div>;

/** Shows the visible month(s); hidden from assistive technology, which hears the root's label. */
export function CalendarHeading(
	{ id = getId(), ...restProps }: CalendarHeadingProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Div(
			mergeProps(
				{
					id,
					"aria-hidden": true,
					[state.attr("heading")]: "",
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
				},
				restProps,
			),
			...(children.length ? children : [state.headingValue]),
		),
	);
}

export type CalendarPrevButtonProps = ComponentProps<typeof Button>;

export function CalendarPrevButton(
	{ id = getId(), ...restProps }: CalendarPrevButtonProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Button(
			mergeProps(
				{
					id,
					type: "button",
					"aria-label": "Previous",
					disabled: state.isPrevButtonDisabled,
					"data-disabled": state.isPrevButtonDisabled.bind((disabled) =>
						disabled ? "" : undefined,
					),
					[state.attr("prev-button")]: "",
					onClick: () => {
						if (state.isPrevButtonDisabled.get()) return;
						state.prevPage();
					},
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarNextButtonProps = ComponentProps<typeof Button>;

export function CalendarNextButton(
	{ id = getId(), ...restProps }: CalendarNextButtonProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Button(
			mergeProps(
				{
					id,
					type: "button",
					"aria-label": "Next",
					disabled: state.isNextButtonDisabled,
					"data-disabled": state.isNextButtonDisabled.bind((disabled) =>
						disabled ? "" : undefined,
					),
					[state.attr("next-button")]: "",
					onClick: () => {
						if (state.isNextButtonDisabled.get()) return;
						state.nextPage();
					},
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarGridProps = ComponentProps<typeof Table>;

export function CalendarGrid(
	{ id = getId(), ...restProps }: CalendarGridProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Table(
			mergeProps(
				{
					id,
					tabIndex: -1,
					role: "grid",
					"aria-readonly": state.readonly,
					"aria-disabled": state.disabled,
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					[state.attr("grid")]: "",
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarGridHeadProps = ComponentProps<typeof Thead>;

export function CalendarGridHead(
	{ id = getId(), ...restProps }: CalendarGridHeadProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Thead(
			mergeProps(
				{
					id,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
					[state.attr("grid-head")]: "",
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarGridBodyProps = ComponentProps<typeof Tbody>;

export function CalendarGridBody(
	{ id = getId(), ...restProps }: CalendarGridBodyProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Tbody(
			mergeProps(
				{
					id,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
					[state.attr("grid-body")]: "",
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarGridRowProps = ComponentProps<typeof Tr>;

export function CalendarGridRow(
	{ id = getId(), ...restProps }: CalendarGridRowProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Tr(
			mergeProps(
				{
					id,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
					[state.attr("grid-row")]: "",
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarHeadCellProps = ComponentProps<typeof Th>;

export function CalendarHeadCell(
	{ id = getId(), ...restProps }: CalendarHeadCellProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((state) =>
		Th(
			mergeProps(
				{
					id,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": state.readonly.bind((readonly) => (readonly ? "" : undefined)),
					[state.attr("head-cell")]: "",
				},
				restProps,
			),
			...children,
		),
	);
}

export type CalendarMonthSelectProps = Omit<ComponentProps<typeof SelectElement>, "value"> & {
	/** The month numbers (1–12) to offer. */
	months?: number[];
	/** How the option labels are formatted. Defaults to the root's `monthFormat`. */
	monthFormat?: MonthFormat;
	disabled?: Signal<boolean> | boolean;
};

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function CalendarMonthSelect({
	id = getId(),
	months = ALL_MONTHS,
	monthFormat,
	disabled = false,
	...restProps
}: CalendarMonthSelectProps) {
	return CalendarBaseCtx.Use((state) => {
		const ownDisabled = signal(disabled);
		const isDisabled = derived([ownDisabled, state.disabled], (own, root) => own || root);
		const format = (month: number): string => {
			if (typeof monthFormat === "function") return monthFormat(month);
			if (monthFormat !== undefined) {
				return formatDate(state.placeholder.get().set({ month }), state.opts.locale, {
					month: monthFormat,
				});
			}
			return state.formatMonth(state.placeholder.get().set({ month }));
		};

		return selectWithValueSync(
			state,
			() => state.placeholder.get().month,
			mergeProps(
				{
					id,
					disabled: isDisabled,
					"data-disabled": isDisabled.bind((value) => (value ? "" : undefined)),
					[state.attr("month-select")]: "",
					onChange: (e: Event) => {
						if (isDisabled.get()) return;
						const month = Number.parseInt((e.target as HTMLSelectElement).value, 10);
						if (!Number.isNaN(month)) state.setMonth(month);
					},
				},
				restProps,
			),
			ForEach(
				months,
				(month) => month,
				(month) =>
					Option(
						{
							value: month.bind(String),
							selected: derived(
								[month, state.placeholder],
								(value, placeholder) => placeholder.month === value,
							),
						},
						month.bind(format),
					),
			),
		);
	});
}

/**
 * A native select whose value follows the placeholder. The value is applied
 * after mount and re-applied on placeholder changes: the `value` prop alone
 * can't do it, since it would land before the options exist.
 */
function selectWithValueSync(
	state: CalendarBaseState,
	currentValue: () => number,
	props: Record<string, unknown>,
	options: Child,
) {
	const selectRef = ref<HTMLSelectElement>();
	const apply = () => {
		const el = selectRef.get();
		if (el) el.value = String(currentValue());
	};
	const unsubscribe = state.placeholder.subscribe(apply);
	return Implement.Lifecycle(
		{ onMount: apply, onUnmount: () => unsubscribe() },
		SelectElement({ this: selectRef, ...props }, options),
	);
}

/** The year window bits-ui offers when no explicit years are passed. */
export function defaultYears(
	placeholderYear: number,
	minValue?: CalendarDate,
	maxValue?: CalendarDate,
): number[] {
	const currentYear = today().year;
	const latestYear = Math.max(placeholderYear, currentYear);
	let minYear: number;
	if (minValue) {
		minYear = minValue.year;
	} else {
		const initialMinYear = latestYear - 100;
		minYear = placeholderYear < initialMinYear ? placeholderYear - 10 : initialMinYear;
	}
	const maxYear = maxValue ? maxValue.year : latestYear + 10;
	if (minYear > maxYear) minYear = maxYear;
	return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
}

export type CalendarYearSelectProps = Omit<ComponentProps<typeof SelectElement>, "value"> & {
	/** The years to offer. Defaults to a window around the current year, bounded by min/max. */
	years?: number[];
	/** How the option labels are formatted. Defaults to the root's `yearFormat`. */
	yearFormat?: YearFormat;
	disabled?: Signal<boolean> | boolean;
};

export function CalendarYearSelect({
	id = getId(),
	years,
	yearFormat,
	disabled = false,
	...restProps
}: CalendarYearSelectProps) {
	return CalendarBaseCtx.Use((state) => {
		const ownDisabled = signal(disabled);
		const isDisabled = derived([ownDisabled, state.disabled], (own, root) => own || root);
		const resolvedYears =
			years && years.length
				? years
				: defaultYears(state.initialPlaceholder.year, state.opts.minValue, state.opts.maxValue);
		const format = (year: number): string => {
			if (typeof yearFormat === "function") return yearFormat(year);
			if (yearFormat !== undefined) {
				return formatDate(state.placeholder.get().set({ year }), state.opts.locale, {
					year: yearFormat,
				});
			}
			return state.formatYear(state.placeholder.get().set({ year }));
		};

		return selectWithValueSync(
			state,
			() => state.placeholder.get().year,
			mergeProps(
				{
					id,
					disabled: isDisabled,
					"data-disabled": isDisabled.bind((value) => (value ? "" : undefined)),
					[state.attr("year-select")]: "",
					onChange: (e: Event) => {
						if (isDisabled.get()) return;
						const year = Number.parseInt((e.target as HTMLSelectElement).value, 10);
						if (!Number.isNaN(year)) state.setYear(year);
					},
				},
				restProps,
			),
			ForEach(
				resolvedYears,
				(year) => year,
				(year) =>
					Option(
						{
							value: year.bind(String),
							selected: derived(
								[year, state.placeholder],
								(value, placeholder) => placeholder.year === value,
							),
						},
						year.bind(format),
					),
			),
		);
	});
}

/** The state every day cell shares between the calendar and range calendar. */
export type SharedCellFlags = {
	disabled: boolean;
	unavailable: boolean;
	today: boolean;
	outsideMonth: boolean;
	outsideVisibleMonths: boolean;
	focused: boolean;
	selected: boolean;
	value: string;
};

export function computeSharedCellFlags(
	state: CalendarBaseState,
	date: CalendarDate,
	month: CalendarDate,
): SharedCellFlags {
	const outsideMonth = !isSameMonth(date, month);
	return {
		disabled: state.isDateDisabled(date) || (outsideMonth && state.opts.disableDaysOutsideMonth),
		unavailable: state.isDateUnavailable(date),
		today: isSameDay(date, today()),
		outsideMonth,
		outsideVisibleMonths: state.isOutsideVisibleMonths(date),
		focused: isSameDay(date, state.placeholder.get()),
		selected: state.isDateSelected(date),
		value: date.toString(),
	};
}

/** The data attributes both cell and day carry, bound to a flags readable. */
export function sharedCellAttrs(flags: Readable<SharedCellFlags>): Record<string, unknown> {
	const present = (pick: (f: SharedCellFlags) => boolean) =>
		flags.bind((f) => (pick(f) ? "" : undefined));
	return {
		"data-unavailable": present((f) => f.unavailable),
		"data-today": present((f) => f.today),
		"data-outside-month": present((f) => f.outsideMonth),
		"data-outside-visible-months": present((f) => f.outsideVisibleMonths),
		"data-focused": present((f) => f.focused),
		"data-selected": present((f) => f.selected),
		"data-disabled": present((f) => f.disabled),
		"data-value": flags.bind((f) => f.value),
	};
}

export function cellAriaDisabled(flags: Readable<SharedCellFlags>): Readable<"true" | "false"> {
	return flags.bind((f) => (f.disabled || f.unavailable ? "true" : "false"));
}

export function dayTabIndex(flags: Readable<SharedCellFlags>): Readable<number | undefined> {
	return flags.bind((f) => (f.disabled ? undefined : f.focused ? 0 : -1));
}

export function dayLabel(state: CalendarBaseState, date: CalendarDate): string {
	return formatDate(date, state.opts.locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

export { DAY_ATTR };
