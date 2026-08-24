import {
	context,
	derived,
	Div,
	ImplementLifecycle,
	isReadable,
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
import { getId, type MaybeReadable } from "../../utils";
import { CalendarDate, formatDate, isSameDay, type Month } from "../helpers/date";
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
	type CalendarGridBodyProps,
	type CalendarGridHeadProps,
	type CalendarGridProps,
	type CalendarGridRowProps,
	type CalendarHeadCellProps,
	type CalendarHeaderProps,
	type CalendarHeadingProps,
	type CalendarMonthSelectProps,
	type CalendarNextButtonProps,
	type CalendarPrevButtonProps,
	type CalendarRenderProps,
	type CalendarYearSelectProps,
} from "./calendar-base";
export {
	CalendarDate,
	isAfter,
	isBefore,
	isBetweenInclusive,
	isSameDay,
	isSameMonth,
	parseDate,
	today,
	type DateDuration,
	type DateFields,
	type Month,
} from "../helpers/date";

export type CalendarRootProps<T extends "single" | "multiple" = "single"> = ComponentProps<
	typeof Div
> &
	CalendarBaseOptions & {
		/** The date the view starts on and keyboard focus follows. Pass a signal to control it. */
		placeholder?: Signal<CalendarDate> | CalendarDate;
		disabled?: Signal<boolean> | boolean;
		readonly?: Signal<boolean> | boolean;
		/** Runs after a date is selected (not after a deselection). */
		onDateSelect?: () => void;
	} & (T extends "multiple"
		? {
				type: "multiple";
				/** The selected dates. Pass a signal to control them from outside. */
				value?: Signal<CalendarDate[]>;
				/** Runs whenever the selected dates change, including a deselection. */
				onValueChange?: ChangeHandler<CalendarDate[]>;
				/** The most dates that can be selected; exceeding it resets to the new date. */
				maxDays?: number;
			}
		: {
				type?: "single";
				/** The selected date. Pass a signal to control it from outside. */
				value?: Signal<CalendarDate | null> | CalendarDate | null;
				/** Runs whenever the selected date changes, including a deselection. */
				onValueChange?: ChangeHandler<CalendarDate | null>;
			});

abstract class CalendarState extends CalendarBaseState {
	constructor(
		opts: CalendarBaseOptions,
		placeholder: Signal<CalendarDate> | CalendarDate | undefined,
		disabled: Signal<boolean> | boolean,
		readonly_: Signal<boolean> | boolean,
		readonly onDateSelect: (() => void) | undefined,
	) {
		super("calendar", opts, placeholder, disabled, readonly_);
	}

	abstract value(): Signal<CalendarDate | null> | Signal<CalendarDate[]>;

	protected announceSelected(date: CalendarDate) {
		announce(`Selected Date: ${formatDate(date, this.opts.locale, { dateStyle: "long" })}`);
	}

	protected announceEmpty() {
		announce("Selected date is now empty.");
	}
}

class CalendarStateSingle extends CalendarState {
	readonly #value: Signal<CalendarDate | null>;
	readonly #invalid: Readable<boolean>;

	constructor(
		opts: CalendarBaseOptions,
		value: Signal<CalendarDate | null> | CalendarDate | null | undefined,
		placeholder: Signal<CalendarDate> | CalendarDate | undefined,
		disabled: Signal<boolean> | boolean,
		readonly_: Signal<boolean> | boolean,
		onDateSelect: (() => void) | undefined,
	) {
		super(
			opts,
			placeholder ?? (value instanceof CalendarDate ? value : undefined) ?? undefined,
			disabled,
			readonly_,
			onDateSelect,
		);
		this.#value = signal(value ?? (null as CalendarDate | null));
		const initial = this.#value.get();
		if (initial) this.placeholder.set(initial);
		// an outside write to the value moves the view to it
		this.unsubscribers.push(
			watch([this.#value], (value) => {
				if (value && !isSameDay(value, this.placeholder.get())) this.placeholder.set(value);
			}),
		);
		this.#invalid = derived([this.#value], (value) => {
			if (!value) return false;
			return this.opts.isDateDisabled(value) || this.opts.isDateUnavailable(value);
		});
	}

	override value() {
		return this.#value;
	}

	override selectionSources(): readonly Readable<any>[] {
		return [this.#value];
	}

	override isDateSelected(date: CalendarDate): boolean {
		const value = this.#value.get();
		return value !== null && isSameDay(value, date);
	}

	override isInvalid(): Readable<boolean> {
		return this.#invalid;
	}

	override handleCellClick(_: Event, date: CalendarDate) {
		if (this.readonly.get() || this.isDateDisabled(date) || this.isDateUnavailable(date)) return;
		const prev = this.#value.get();
		if (prev && isSameDay(prev, date) && !this.opts.preventDeselect) {
			this.#value.set(null);
			this.placeholder.set(date);
			this.announceEmpty();
			return;
		}
		this.#value.set(date);
		this.announceSelected(date);
		this.onDateSelect?.();
	}
}

class CalendarStateMultiple extends CalendarState {
	readonly #value: Signal<CalendarDate[]>;
	readonly #invalid: Readable<boolean>;

	constructor(
		opts: CalendarBaseOptions,
		value: Signal<CalendarDate[]> | undefined,
		readonly maxDays: number | undefined,
		placeholder: Signal<CalendarDate> | CalendarDate | undefined,
		disabled: Signal<boolean> | boolean,
		readonly_: Signal<boolean> | boolean,
		onDateSelect: (() => void) | undefined,
	) {
		super(
			opts,
			placeholder ?? value?.get()[value.get().length - 1],
			disabled,
			readonly_,
			onDateSelect,
		);
		this.#value = signal(value ?? ([] as CalendarDate[]));
		this.unsubscribers.push(
			watch([this.#value], (dates) => {
				const last = dates[dates.length - 1];
				if (last && !isSameDay(last, this.placeholder.get())) this.placeholder.set(last);
			}),
		);
		this.#invalid = derived([this.#value], (dates) =>
			dates.some((date) => this.opts.isDateDisabled(date) || this.opts.isDateUnavailable(date)),
		);
	}

	override value() {
		return this.#value;
	}

	override selectionSources(): readonly Readable<any>[] {
		return [this.#value];
	}

	override isDateSelected(date: CalendarDate): boolean {
		return this.#value.get().some((d) => isSameDay(d, date));
	}

	override isInvalid(): Readable<boolean> {
		return this.#invalid;
	}

	override handleCellClick(_: Event, date: CalendarDate) {
		if (this.readonly.get() || this.isDateDisabled(date) || this.isDateUnavailable(date)) return;
		const prev = this.#value.get();
		const index = prev.findIndex((d) => isSameDay(d, date));
		if (index === -1) {
			const next = [...prev, date];
			// exceeding maxDays starts a fresh selection at the clicked date
			this.#value.set(this.maxDays && next.length > this.maxDays ? [date] : next);
			this.announceSelected(date);
			this.onDateSelect?.();
			return;
		}
		if (this.opts.preventDeselect) return;
		const next = prev.filter((d) => !isSameDay(d, date));
		this.#value.set(next);
		if (!next.length) {
			this.placeholder.set(date);
			this.announceEmpty();
		}
	}
}

type CalendarAnyProps = ComponentProps<typeof Div> &
	CalendarBaseOptions & {
		type?: "single" | "multiple";
		value?: Signal<CalendarDate | null> | CalendarDate | null | Signal<CalendarDate[]>;
		onValueChange?: ChangeHandler<CalendarDate | null> | ChangeHandler<CalendarDate[]>;
		maxDays?: number;
		placeholder?: Signal<CalendarDate> | CalendarDate;
		disabled?: Signal<boolean> | boolean;
		readonly?: Signal<boolean> | boolean;
		onDateSelect?: () => void;
	};

/**
 * The root. Owns the selected value and the visible months, and calls
 * `children` with them so you can lay out the grid.
 */
export function Calendar(
	props: CalendarRootProps | CalendarRootProps<"multiple">,
	children: (calendar: CalendarRenderProps) => Child,
) {
	const {
		id = getId(),
		type = "single",
		value,
		onValueChange,
		maxDays,
		placeholder,
		disabled = false,
		readonly: readonlyProp = false,
		onDateSelect,
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
	} = props as CalendarAnyProps;

	const baseOpts: CalendarBaseOptions = {
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
	};

	/* oxlint-disable typescript/no-unsafe-type-assertion -- Discriminated `type` prop selects the matching calendar state class. */
	const state =
		type === "multiple"
			? new CalendarStateMultiple(
					baseOpts,
					value as Signal<CalendarDate[]> | undefined,
					maxDays,
					placeholder,
					disabled,
					readonlyProp,
					onDateSelect,
				)
			: new CalendarStateSingle(
					baseOpts,
					value as Signal<CalendarDate | null> | CalendarDate | null | undefined,
					placeholder,
					disabled,
					readonlyProp,
					onDateSelect,
				);
	// the same `type` decides which shape the callback is handed
	const valueChange = changeEffect(
		state.value() as Readable<CalendarDate | CalendarDate[] | null>,
		onValueChange as ChangeHandler<CalendarDate | CalendarDate[] | null> | undefined,
	);
	/* oxlint-enable typescript/no-unsafe-type-assertion */

	const invalid = state.isInvalid();

	return CalendarBaseCtx.Provide(state).To(
		...valueChange,
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

type CalendarCellState = {
	date: Readable<CalendarDate>;
	flags: Readable<SharedCellFlags>;
	root: CalendarBaseState;
};

const CalendarCellCtx = context<CalendarCellState>("CalendarCellCtx");

function toReadable<T>(value: MaybeReadable<T>): Readable<T> {
	return isReadable(value) ? value : signal(value);
}

export type CalendarCellProps = ComponentProps<typeof Td> & {
	/** The date this cell renders. */
	date: MaybeReadable<CalendarDate>;
	/** The month (any date within it) whose grid the cell sits in. */
	month: MaybeReadable<CalendarDate | Month>;
};

export const CalendarCell = createComponent(function CalendarCell(
	{ id = getId(), date, month, ...restProps }: CalendarCellProps,
	...children: Child[]
) {
	return CalendarBaseCtx.Use((root) => {
		const dateR = toReadable(date);
		const monthR = toReadable(month).bind((m) => (m instanceof CalendarDate ? m : m.value));
		const flags = derived(
			[dateR, monthR, root.months, root.placeholder, root.disabled, ...root.selectionSources()],
			(d, m) => computeSharedCellFlags(root, d, m),
		);

		return CalendarCellCtx.Provide({ date: dateR, flags, root }).To(
			Td(
				mergeProps(
					{
						id,
						role: "gridcell",
						"aria-selected": flags.bind((f) => (f.selected ? "true" : "false")),
						"aria-disabled": cellAriaDisabled(flags),
						...sharedCellAttrs(flags),
						[root.attr("cell")]: "",
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type CalendarDayProps = ComponentProps<typeof Div>;

/** One selectable day. Without children it renders the day number. */
export const CalendarDay = createComponent(function CalendarDay(
	{ id = getId(), ...restProps }: CalendarDayProps,
	...children: Child[]
) {
	return CalendarCellCtx.Use(({ date, flags, root }) =>
		Div(
			mergeProps(
				{
					id,
					role: "button",
					"aria-label": date.bind((d) => dayLabel(root, d)),
					"aria-disabled": cellAriaDisabled(flags),
					...sharedCellAttrs(flags),
					tabIndex: dayTabIndex(flags),
					[root.attr("day")]: "",
					[DAY_ATTR]: "",
					onClick: (e: Event) => {
						if (flags.get().disabled) return;
						root.handleCellClick(e, date.get());
					},
				},
				restProps,
			),
			...(children.length ? children : [date.bind((d) => String(d.day))]),
		),
	);
});
