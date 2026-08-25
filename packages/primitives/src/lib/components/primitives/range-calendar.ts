import {
	context,
	derived,
	Div,
	ImplementLifecycle,
	signal,
	Td,
	watch,
	type Child,
	type ComponentProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable, type MaybeReadable } from "../../utils";
import {
	CalendarDate,
	formatDate,
	isBefore,
	isBetweenInclusive,
	isSameDay,
	type Month,
} from "../helpers/date";
import {
	announce,
	CalendarAccessibleHeading,
	CalendarBaseCtx,
	CalendarBaseState,
	cellAriaDisabled,
	computeSharedCellFlags,
	DAY_ATTR,
	dayLabel,
	dayTabIndex,
	sharedCellAttrs,
	type CalendarBaseOptions,
	type CalendarRenderProps,
	type SharedCellFlags,
} from "./calendar-base";
import { createComponent } from "../../create-component";

export {
	CalendarGrid as RangeCalendarGrid,
	CalendarGridBody as RangeCalendarGridBody,
	CalendarGridHead as RangeCalendarGridHead,
	CalendarGridRow as RangeCalendarGridRow,
	CalendarHeadCell as RangeCalendarHeadCell,
	CalendarHeader as RangeCalendarHeader,
	CalendarHeading as RangeCalendarHeading,
	CalendarMonthSelect as RangeCalendarMonthSelect,
	CalendarNextButton as RangeCalendarNextButton,
	CalendarPrevButton as RangeCalendarPrevButton,
	CalendarYearSelect as RangeCalendarYearSelect,
	type CalendarGridBodyProps as RangeCalendarGridBodyProps,
	type CalendarGridHeadProps as RangeCalendarGridHeadProps,
	type CalendarGridProps as RangeCalendarGridProps,
	type CalendarGridRowProps as RangeCalendarGridRowProps,
	type CalendarHeadCellProps as RangeCalendarHeadCellProps,
	type CalendarHeaderProps as RangeCalendarHeaderProps,
	type CalendarHeadingProps as RangeCalendarHeadingProps,
	type CalendarMonthSelectProps as RangeCalendarMonthSelectProps,
	type CalendarNextButtonProps as RangeCalendarNextButtonProps,
	type CalendarPrevButtonProps as RangeCalendarPrevButtonProps,
	type CalendarYearSelectProps as RangeCalendarYearSelectProps,
} from "./calendar-base";

/** A selected span of days. Either side is `null` while the selection is in progress. */
export type DateRange = {
	start: CalendarDate | null;
	end: CalendarDate | null;
};

export type RangeCalendarRootProps = ComponentProps<typeof Div> &
	CalendarBaseOptions & {
		/** The selected range. Pass a signal to control it from outside. */
		value?: Signal<DateRange> | DateRange;
		/** Runs whenever the range changes, including while only one end is picked. */
		onValueChange?: ChangeHandler<DateRange>;
		/** The date the view starts on and keyboard focus follows. Pass a signal to control it. */
		placeholder?: Signal<CalendarDate> | CalendarDate;
		disabled?: Readable<boolean> | boolean;
		readonly?: Readable<boolean> | boolean;
		/** The fewest days a range may span. Shorter picks restart the selection. */
		minDays?: number;
		/** The most days a range may span. Longer picks restart the selection. */
		maxDays?: number;
		/** Clear the range if it would contain a disabled date. */
		excludeDisabled?: boolean;
		/** Runs after both ends of the range are selected. */
		onRangeSelect?: () => void;
	};

class RangeCalendarState extends CalendarBaseState {
	readonly value: Signal<DateRange>;
	readonly focusedValue = signal<CalendarDate | null>(null);
	readonly highlightedRange: Readable<{ start: CalendarDate; end: CalendarDate } | null>;
	lastPressedDate: CalendarDate | null = null;
	readonly #invalid: Readable<boolean>;

	constructor(
		opts: CalendarBaseOptions,
		value: Signal<DateRange> | DateRange | undefined,
		placeholder: Signal<CalendarDate> | CalendarDate | undefined,
		disabled: Readable<boolean> | boolean,
		readonly_: Readable<boolean> | boolean,
		readonly minDays: number | undefined,
		readonly maxDays: number | undefined,
		readonly excludeDisabled: boolean,
		readonly onRangeSelect: (() => void) | undefined,
	) {
		super("range-calendar", opts, placeholder, disabled, readonly_);
		this.value = signal(value ?? { start: null, end: null });
		const initialStart = this.value.get().start;
		if (!placeholder && initialStart) this.placeholder.set(initialStart);

		this.unsubscribers.push(
			watch([this.value], (range) => {
				// keep the range ordered no matter how it was written
				if (range.start && range.end && isBefore(range.end, range.start)) {
					this.value.set({ start: range.end, end: range.start });
					return;
				}
				if (
					this.excludeDisabled &&
					range.start &&
					range.end &&
					this.hasDisabledDatesInRange(range.start, range.end)
				) {
					this.value.set({ start: null, end: null });
					this.announceEmpty();
					return;
				}
				// an outside write to the start moves the view to it
				if (range.start && !isSameDay(range.start, this.placeholder.get())) {
					this.placeholder.set(range.start);
				}
			}),
		);

		this.highlightedRange = derived([this.value, this.focusedValue], (range, focused) => {
			if (range.start && range.end) return null;
			if (!range.start || !focused) return null;
			const startBeforeFocused = isBefore(range.start, focused);
			const start = startBeforeFocused ? range.start : focused;
			const end = startBeforeFocused ? focused : range.start;
			if (isSameDay(start.add({ days: 1 }), end) || isSameDay(start, end)) {
				return { start, end };
			}
			return this.areAllDaysBetweenValid(start, end) ? { start, end } : null;
		});

		this.#invalid = derived([this.value], (range) => {
			for (const date of [range.start, range.end]) {
				if (!date) continue;
				if (this.opts.isDateDisabled(date) || this.opts.isDateUnavailable(date)) return true;
			}
			if (range.start && range.end && isBefore(range.end, range.start)) return true;
			return false;
		});
	}

	override selectionSources(): readonly Readable<any>[] {
		return [this.value, this.focusedValue];
	}

	override isDateSelected(date: CalendarDate): boolean {
		const { start, end } = this.value.get();
		if (start && isSameDay(start, date)) return true;
		if (end && isSameDay(end, date)) return true;
		if (start && end) return isBetweenInclusive(date, start, end);
		return false;
	}

	isSelectionStart(date: CalendarDate): boolean {
		const start = this.value.get().start;
		return start !== null && isSameDay(start, date);
	}

	isSelectionEnd(date: CalendarDate): boolean {
		const end = this.value.get().end;
		return end !== null && isSameDay(end, date);
	}

	override isInvalid(): Readable<boolean> {
		return this.#invalid;
	}

	#setStart(date: CalendarDate | null) {
		this.value.set({ ...this.value.get(), start: date });
		this.#notifyIfComplete();
	}

	#notifyIfComplete() {
		const { start, end } = this.value.get();
		if (start && end) this.onRangeSelect?.();
	}

	private announceEmpty() {
		announce("Selected date is now empty.");
	}

	private announceSelected(date: CalendarDate) {
		announce(`Selected Date: ${formatDate(date, this.opts.locale, { dateStyle: "long" })}`);
	}

	private announceRange(start: CalendarDate, end: CalendarDate) {
		announce(
			`Selected Dates: ${formatDate(start, this.opts.locale, { dateStyle: "long" })} to ${formatDate(end, this.opts.locale, { dateStyle: "long" })}`,
		);
	}

	private areAllDaysBetweenValid(start: CalendarDate, end: CalendarDate): boolean {
		let current = start.add({ days: 1 });
		while (isBefore(current, end)) {
			if (this.opts.isDateDisabled(current) || this.opts.isDateUnavailable(current)) return false;
			current = current.add({ days: 1 });
		}
		return true;
	}

	private hasDisabledDatesInRange(start: CalendarDate, end: CalendarDate): boolean {
		for (let date = start; date.compare(end) <= 0; date = date.add({ days: 1 })) {
			if (this.isDateDisabled(date)) return true;
		}
		return false;
	}

	private isRangeValid(start: CalendarDate, end: CalendarDate): boolean {
		const daysInRange = end.compare(start) + 1;
		if (this.minDays && daysInRange < this.minDays) return false;
		if (this.maxDays && daysInRange > this.maxDays) return false;
		if (this.excludeDisabled && this.hasDisabledDatesInRange(start, end)) return false;
		return true;
	}

	override handleCellClick(e: Event, date: CalendarDate) {
		if (this.readonly.get() || this.isDateDisabled(date) || this.isDateUnavailable(date)) return;
		const prevLastPressed = this.lastPressedDate;
		this.lastPressedDate = date;
		const { start, end } = this.value.get();

		if (start && this.highlightedRange.get() === null) {
			if (isSameDay(start, date) && !this.opts.preventDeselect && !end) {
				this.#setStart(null);
				this.placeholder.set(date);
				this.announceEmpty();
				return;
			} else if (!end) {
				// the highlight was interrupted (an invalid day sits in between);
				// a second press on the same day restarts the range there
				e.preventDefault();
				if (prevLastPressed && isSameDay(prevLastPressed, date)) {
					this.#setStart(date);
					this.announceSelected(date);
				}
			}
		}

		if (start && end && isSameDay(end, date) && !this.opts.preventDeselect) {
			this.value.set({ start: null, end: null });
			this.placeholder.set(date);
			this.announceEmpty();
			return;
		}

		if (!start) {
			this.announceSelected(date);
			this.#setStart(date);
		} else if (!end) {
			const backward = isBefore(date, start);
			const orderedStart = backward ? date : start;
			const orderedEnd = backward ? start : date;
			if (!this.isRangeValid(orderedStart, orderedEnd)) {
				// the pick violates min/max/excludeDisabled: restart at the clicked date
				this.value.set({ start: date, end: null });
				this.announceSelected(date);
			} else {
				this.value.set({ start: orderedStart, end: orderedEnd });
				this.#notifyIfComplete();
				this.announceRange(orderedStart, orderedEnd);
			}
		} else {
			this.value.set({ start: date, end: null });
			this.announceSelected(date);
		}
	}
}

/**
 * The root. Owns the selected range and the visible months, and calls
 * `children` with them so you can lay out the grid.
 */
export function RangeCalendar(
	props: RangeCalendarRootProps,
	children: (calendar: CalendarRenderProps) => Child,
) {
	const {
		id = getId(),
		value,
		onValueChange,
		placeholder,
		disabled = false,
		readonly: readonlyProp = false,
		minDays,
		maxDays,
		excludeDisabled = false,
		onRangeSelect,
		minValue,
		maxValue,
		isDateDisabled,
		isDateUnavailable,
		preventDeselect,
		fixedWeeks,
		numberOfMonths,
		pagedNavigation,
		weekStartsOn,
		weekdayFormat,
		disableDaysOutsideMonth,
		locale,
		calendarLabel,
		monthFormat,
		yearFormat,
		...restProps
	} = props;

	const state = new RangeCalendarState(
		{
			minValue,
			maxValue,
			isDateDisabled,
			isDateUnavailable,
			preventDeselect,
			fixedWeeks,
			numberOfMonths,
			pagedNavigation,
			weekStartsOn,
			weekdayFormat,
			disableDaysOutsideMonth,
			locale,
			calendarLabel,
			monthFormat,
			yearFormat,
		},
		value,
		placeholder,
		disabled,
		readonlyProp,
		minDays,
		maxDays,
		excludeDisabled,
		onRangeSelect,
	);

	const invalid = state.isInvalid();

	return CalendarBaseCtx.Provide(state).To(
		...changeEffect(state.value, onValueChange),
		ImplementLifecycle(
			{
				onMount: () => state.ensureNonDisabledPlaceholder(),
				onUnmount: () => state.dispose(),
			},
			Div(
				mergeProps(
					{
						id,
						this: state.root,
						role: "application",
						"aria-label": state.fullCalendarLabel,
						[state.attr("root")]: "",
						"data-invalid": invalid.bind((value) => (value ? "" : undefined)),
						"data-disabled": state.disabled.bind((value) => (value ? "" : undefined)),
						"data-readonly": state.readonly.bind((value) => (value ? "" : undefined)),
						onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					},
					restProps,
				),
				CalendarAccessibleHeading(state),
				children({ months: state.months, weekdays: state.weekdays }),
			),
		),
	);
}

type RangeCellFlags = SharedCellFlags & {
	selectionStart: boolean;
	selectionEnd: boolean;
	rangeStart: boolean;
	rangeEnd: boolean;
	rangeMiddle: boolean;
	highlighted: boolean;
};

type RangeCalendarCellState = {
	date: Readable<CalendarDate>;
	flags: Readable<RangeCellFlags>;
	root: RangeCalendarState;
};

const RangeCalendarCellCtx = context<RangeCalendarCellState>("RangeCalendarCellCtx");

export type RangeCalendarCellProps = ComponentProps<typeof Td> & {
	/** The date this cell renders. */
	date: MaybeReadable<CalendarDate>;
	/** The month (any date within it) whose grid the cell sits in. */
	month: MaybeReadable<CalendarDate | Month>;
};

export const RangeCalendarCell = createComponent(function RangeCalendarCell(
	{ id = getId(), date, month, ...restProps }: RangeCalendarCellProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((base) => {
		if (!(base instanceof RangeCalendarState)) {
			throw new Error("RangeCalendarCell must be used within a RangeCalendar.");
		}
		const root = base;
		const dateR = toReadable(date);
		const monthR = toReadable(month).bind((m) => (m instanceof CalendarDate ? m : m.value));
		const flags = derived(
			[dateR, monthR, root.months, root.placeholder, root.disabled, root.value, root.focusedValue],
			(d, m): RangeCellFlags => {
				const shared = computeSharedCellFlags(root, d, m);
				const selectionStart = root.isSelectionStart(d);
				const selectionEnd = root.isSelectionEnd(d);
				const hasEnd = root.value.get().end !== null;
				const highlightedRange = root.highlightedRange.get();
				return {
					...shared,
					selectionStart,
					selectionEnd,
					rangeStart: selectionStart,
					rangeEnd: hasEnd ? selectionEnd : selectionStart,
					rangeMiddle: shared.selected && !selectionStart && !selectionEnd,
					highlighted: highlightedRange
						? isBetweenInclusive(d, highlightedRange.start, highlightedRange.end)
						: false,
				};
			},
		);

		const present = (pick: (f: RangeCellFlags) => boolean) =>
			flags.bind((f) => (pick(f) ? "" : undefined));

		return RangeCalendarCellCtx.Provide({ date: dateR, flags, root }).To(
			Td(
				mergeProps(
					{
						id,
						role: "gridcell",
						"aria-selected": flags.bind((f) => (f.selected ? "true" : "false")),
						"aria-disabled": cellAriaDisabled(flags),
						...sharedCellAttrs(flags),
						...rangeCellAttrs(present),
						[root.attr("cell")]: "",
					},
					restProps,
				),
				...children,
			),
		);
	});
});

function rangeCellAttrs(
	present: (pick: (f: RangeCellFlags) => boolean) => Readable<string | undefined>,
): Record<string, unknown> {
	return {
		"data-selection-start": present((f) => f.selectionStart),
		"data-selection-end": present((f) => f.selectionEnd),
		"data-range-start": present((f) => f.rangeStart),
		"data-range-end": present((f) => f.rangeEnd),
		"data-range-middle": present((f) => f.rangeMiddle),
		"data-highlighted": present((f) => f.highlighted),
	};
}

export type RangeCalendarDayProps = ComponentProps<typeof Div>;

/** One selectable day. Without children it renders the day number. */
export const RangeCalendarDay = createComponent(function RangeCalendarDay(
	{ id = getId(), ...restProps }: RangeCalendarDayProps,
	...children: Child[]
) {
	return RangeCalendarCellCtx.Use(({ date, flags, root }) => {
		const present = (pick: (f: RangeCellFlags) => boolean) =>
			flags.bind((f) => (pick(f) ? "" : undefined));
		const focus = () => {
			if (flags.get().disabled) return;
			root.focusedValue.set(date.get());
		};

		return Div(
			mergeProps(
				{
					id,
					role: "button",
					"aria-label": date.bind((d) => dayLabel(root, d)),
					"aria-disabled": cellAriaDisabled(flags),
					...sharedCellAttrs(flags),
					...rangeCellAttrs(present),
					tabIndex: dayTabIndex(flags),
					[root.attr("day")]: "",
					[DAY_ATTR]: "",
					onClick: (e: Event) => {
						if (flags.get().disabled) return;
						root.handleCellClick(e, date.get());
					},
					onMouseenter: focus,
					onFocusin: focus,
				},
				restProps,
			),
			...(children.length ? children : [date.bind((d) => String(d.day))]),
		);
	});
});
