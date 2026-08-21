export type ApiProp = {
	name: string;
	type: string;
	default?: string;
	required?: boolean;
	description: string;
};

export type ApiDataAttribute = {
	name: string;
	/** The values the attribute takes, or what its presence means. */
	value: string;
};

export type ApiCssVariable = {
	name: string;
	description: string;
};

/** The heading id (and `#` anchor) an API part's section renders with. */
export function apiPartId(name: string): string {
	return name.toLowerCase();
}

export type ApiPart = {
	name: string;
	/** The element factory the part renders and forwards extra props onto. */
	element?: string;
	description?: string;
	props?: ApiProp[];
	dataAttributes?: ApiDataAttribute[];
	cssVariables?: ApiCssVariable[];
};

/**
 * The parts DropdownMenu, ContextMenu, and Menubar share from the menu base —
 * identical behavior, with data attributes named after the flavor.
 */
function menuParts(prefix: string, variant: string): ApiPart[] {
	return [
		{
			name: `${prefix}Content`,
			element: "Div",
			description:
				'The floating panel of items. Sets role="menu". Style it against data-state and data-side; the primitive does not hide it for you.',
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"bottom"',
					description: "Preferred side of the anchor to place the panel.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"start"',
					description: "How the panel aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the anchor and the panel.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last item back to the first.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-content`, value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
		},
		{
			name: `${prefix}Item`,
			element: "Div",
			description: 'One action. Sets role="menuitem"; focus follows the pointer.',
			props: [
				{
					name: "onSelect",
					type: "() => void",
					description: "Runs when the item is activated with a click, Enter, or Space.",
				},
				{
					name: "closeOnSelect",
					type: "boolean",
					default: "true",
					description: "Whether selecting the item closes the menu.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents selecting the item; the keyboard skips it.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-item`, value: "Present" },
				{ name: "data-highlighted", value: "Present while focused" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}CheckboxItem`,
			element: "Div",
			description:
				'An item holding a checked state. Sets role="menuitemcheckbox" and aria-checked.',
			props: [
				{
					name: "checked",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The checked state; selecting toggles it. Pass a signal to control it from outside.",
				},
				{
					name: "closeOnSelect",
					type: "boolean",
					default: "true",
					description: "Whether selecting the item closes the menu.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents selecting the item; the keyboard skips it.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-checkbox-item`, value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked"' },
				{ name: "data-highlighted", value: "Present while focused" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}RadioGroup`,
			element: "Div",
			description: "Wraps radio items and owns which one is checked.",
			props: [
				{
					name: "value",
					type: "Signal<string | null> | string | null",
					default: "null",
					description: "The checked item. Pass a signal to control it from outside.",
				},
			],
			dataAttributes: [{ name: `data-${variant}-radio-group`, value: "Present" }],
		},
		{
			name: `${prefix}RadioItem`,
			element: "Div",
			description: 'One choice in a radio group. Sets role="menuitemradio" and aria-checked.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the item. Must be unique within the radio group.",
				},
				{
					name: "closeOnSelect",
					type: "boolean",
					default: "true",
					description: "Whether selecting the item closes the menu.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents selecting the item; the keyboard skips it.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-radio-item`, value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked"' },
				{ name: "data-highlighted", value: "Present while focused" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}Sub`,
			description:
				"A nested menu. Wraps a sub trigger and its sub content inside a parent content.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
			],
		},
		{
			name: `${prefix}SubTrigger`,
			element: "Div",
			description:
				"The item that opens its submenu — on hover after openDelay, ArrowRight, Enter, Space, or click. Sets aria-haspopup and aria-expanded.",
			props: [
				{
					name: "openDelay",
					type: "number",
					default: "100",
					description:
						"How long the pointer must rest on the trigger before the submenu opens, in milliseconds.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents opening the submenu; the keyboard skips the item.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-sub-trigger`, value: "Present" },
				{ name: `data-${variant}-item`, value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-highlighted", value: "Present while focused" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}SubContent`,
			element: "Div",
			description:
				"The submenu's panel, positioned against its trigger. ArrowLeft closes it and returns focus; the keyboard model inside matches the parent content.",
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"right"',
					description: "Preferred side of the sub trigger to place the panel.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"start"',
					description: "How the panel aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the sub trigger and the panel.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last item back to the first.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-sub-content`, value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
		},
		{
			name: `${prefix}Group`,
			element: "Div",
			description: 'Wraps related items in role="group", labeled by the heading placed inside it.',
			dataAttributes: [{ name: `data-${variant}-group`, value: "Present" }],
		},
		{
			name: `${prefix}GroupHeading`,
			element: "Div",
			description: "Names the group it sits in; the group points aria-labelledby at it.",
			dataAttributes: [{ name: `data-${variant}-group-heading`, value: "Present" }],
		},
		{
			name: `${prefix}Separator`,
			element: "Div",
			description: 'A role="separator" line between sections.',
			dataAttributes: [{ name: `data-${variant}-separator`, value: "Present" }],
		},
		{
			name: `${prefix}Portal`,
			description:
				"The core Portal helper, for rendering the panel into another DOM parent to escape overflow and stacking.",
		},
	];
}

/**
 * The parts Calendar and RangeCalendar share — identical behavior, with data
 * attributes named after the flavor.
 */
function calendarParts(prefix: string, variant: string): ApiPart[] {
	const stateAttrs: ApiDataAttribute[] = [
		{ name: "data-disabled", value: "Present when the calendar is disabled" },
		{ name: "data-readonly", value: "Present when the calendar is readonly" },
	];
	return [
		{
			name: `${prefix}Header`,
			element: "Div",
			description: "Wraps the heading and the nav buttons.",
			dataAttributes: [{ name: `data-${variant}-header`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}Heading`,
			element: "Div",
			description:
				"Shows the visible month(s). Renders the formatted heading unless children are passed. aria-hidden — assistive technology hears the root's label instead.",
			dataAttributes: [{ name: `data-${variant}-heading`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}PrevButton`,
			element: "Button",
			description:
				"Pages the view backwards. Disables itself when the previous page falls entirely before minValue.",
			dataAttributes: [
				{ name: `data-${variant}-prev-button`, value: "Present" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}NextButton`,
			element: "Button",
			description:
				"Pages the view forwards. Disables itself when the next page falls entirely after maxValue.",
			dataAttributes: [
				{ name: `data-${variant}-next-button`, value: "Present" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}Grid`,
			element: "Table",
			description: 'One month\'s grid. Sets role="grid" and the aria disabled/readonly state.',
			dataAttributes: [{ name: `data-${variant}-grid`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}GridHead`,
			element: "Thead",
			description: "Holds the weekday header row.",
			dataAttributes: [{ name: `data-${variant}-grid-head`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}GridRow`,
			element: "Tr",
			description: "One row: the weekday names in the head, a week in the body.",
			dataAttributes: [{ name: `data-${variant}-grid-row`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}HeadCell`,
			element: "Th",
			description: "One weekday name. Render the strings from the weekdays render prop into these.",
			dataAttributes: [{ name: `data-${variant}-head-cell`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}GridBody`,
			element: "Tbody",
			description: "Holds the week rows.",
			dataAttributes: [{ name: `data-${variant}-grid-body`, value: "Present" }, ...stateAttrs],
		},
		{
			name: `${prefix}MonthSelect`,
			element: "Select",
			description:
				"A native select that jumps the view to a month. Renders localized options for every month unless narrowed with the months prop.",
			props: [
				{
					name: "months",
					type: "number[]",
					default: "[1 … 12]",
					description: "The month numbers to offer.",
				},
				{
					name: "monthFormat",
					type: 'Intl.DateTimeFormatOptions["month"] | ((month: number) => string)',
					description: "How option labels are formatted. Defaults to the root's monthFormat.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents changing the month.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-month-select`, value: "Present" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: `${prefix}YearSelect`,
			element: "Select",
			description:
				"A native select that jumps the view to a year. Offers roughly the last hundred years through the next ten, bounded by minValue/maxValue.",
			props: [
				{
					name: "years",
					type: "number[]",
					description: "The years to offer. Defaults to a window around the current year.",
				},
				{
					name: "yearFormat",
					type: 'Intl.DateTimeFormatOptions["year"] | ((year: number) => string)',
					description: "How option labels are formatted. Defaults to the root's yearFormat.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents changing the year.",
				},
			],
			dataAttributes: [
				{ name: `data-${variant}-year-select`, value: "Present" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
	];
}

/** The root props Calendar and RangeCalendar share. */
function calendarSharedRootProps(): ApiProp[] {
	return [
		{
			name: "placeholder",
			type: "Signal<CalendarDate> | CalendarDate",
			default: "today",
			description:
				"The date the view starts on and keyboard focus follows. Pass a signal to control the view from outside.",
		},
		{
			name: "minValue",
			type: "CalendarDate",
			description: "The earliest selectable date. Earlier dates are disabled.",
		},
		{
			name: "maxValue",
			type: "CalendarDate",
			description: "The latest selectable date. Later dates are disabled.",
		},
		{
			name: "isDateDisabled",
			type: "(date: CalendarDate) => boolean",
			description: "Marks dates as disabled: not selectable and skipped by the keyboard.",
		},
		{
			name: "isDateUnavailable",
			type: "(date: CalendarDate) => boolean",
			description:
				"Marks dates as unavailable: focusable and rendered, but not selectable. Sets data-unavailable.",
		},
		{
			name: "preventDeselect",
			type: "boolean",
			default: "false",
			description: "Whether clicking a selected date again keeps it selected.",
		},
		{
			name: "disabled",
			type: "Signal<boolean> | boolean",
			default: "false",
			description: "Disables the whole calendar.",
		},
		{
			name: "readonly",
			type: "Signal<boolean> | boolean",
			default: "false",
			description: "The value can be read but not changed.",
		},
		{
			name: "fixedWeeks",
			type: "boolean",
			default: "false",
			description: "Always render six weeks per month so the grid height never changes.",
		},
		{
			name: "numberOfMonths",
			type: "number",
			default: "1",
			description: "How many consecutive months are rendered.",
		},
		{
			name: "pagedNavigation",
			type: "boolean",
			default: "false",
			description: "Whether prev/next move by numberOfMonths months instead of one.",
		},
		{
			name: "weekStartsOn",
			type: "0 | 1 | 2 | 3 | 4 | 5 | 6",
			description:
				"The day the week starts on, 0 being Sunday. Defaults to the locale's week start where the runtime knows it.",
		},
		{
			name: "weekdayFormat",
			type: '"narrow" | "short" | "long"',
			default: '"narrow"',
			description: "The Intl width of the weekday names handed to the render function.",
		},
		{
			name: "disableDaysOutsideMonth",
			type: "boolean",
			default: "true",
			description: "Whether the leading and trailing days outside the month are disabled.",
		},
		{
			name: "locale",
			type: "string",
			default: '"en-US"',
			description: "BCP 47 locale tag used for all formatting.",
		},
		{
			name: "calendarLabel",
			type: "string",
			default: '"Event"',
			description:
				"Prefixed onto the visible month to label the calendar for assistive technology.",
		},
		{
			name: "monthFormat",
			type: 'Intl.DateTimeFormatOptions["month"] | ((month: number) => string)',
			default: '"long"',
			description: "How the heading and month select format month names.",
		},
		{
			name: "yearFormat",
			type: 'Intl.DateTimeFormatOptions["year"] | ((year: number) => string)',
			default: '"numeric"',
			description: "How the heading and year select format years.",
		},
	];
}

/** The state attributes shared by both variants' cells and days. */
function calendarCellDataAttributes(variant: string, part: "cell" | "day"): ApiDataAttribute[] {
	return [
		{ name: `data-${variant}-${part}`, value: "Present" },
		{ name: "data-value", value: "The cell's date as YYYY-MM-DD" },
		{ name: "data-selected", value: "Present when selected" },
		{ name: "data-focused", value: "Present when the placeholder is this date" },
		{ name: "data-today", value: "Present on today's date" },
		{ name: "data-outside-month", value: "Present on leading/trailing days" },
		{
			name: "data-outside-visible-months",
			value: "Present when the date falls outside every rendered month",
		},
		{ name: "data-disabled", value: "Present when disabled" },
		{ name: "data-unavailable", value: "Present when unavailable" },
	];
}

const rangeCellDataAttributes: ApiDataAttribute[] = [
	{ name: "data-selection-start", value: "Present on the range's start date" },
	{ name: "data-selection-end", value: "Present on the range's end date" },
	{ name: "data-range-start", value: "Present on the visual start, even while the end is unset" },
	{ name: "data-range-end", value: "Present on the visual end, even while the end is unset" },
	{ name: "data-range-middle", value: "Present strictly inside a complete range" },
	{
		name: "data-highlighted",
		value: "Present on the prospective span while the end is being picked",
	},
];

/**
 * API reference tables, keyed by the `data-api` attribute a docs page uses to
 * place them: `<div data-api="avatar"></div>` in the markdown renders the
 * tables for every part of that primitive at that spot.
 */
export const apiReference: Record<string, ApiPart[]> = {
	command: [
		{
			name: "Command",
			element: "Div",
			description:
				"The root. Owns the search and the highlighted value, scores every item against the search, and handles the keyboard.",
			props: [
				{
					name: "label",
					type: "string",
					description: "An accessible label for the menu. Not visible; read to screen readers.",
				},
				{
					name: "value",
					type: "Signal<string> | string",
					description:
						"The value of the highlighted item. Pass a signal to control or observe it from outside.",
				},
				{
					name: "search",
					type: "Signal<string> | string",
					description:
						"The search query. Pass a signal to control or observe it from outside; CommandInput binds to it.",
				},
				{
					name: "shouldFilter",
					type: "boolean",
					default: "true",
					description:
						"Set to false to turn off the automatic filtering and sorting, and conditionally render valid items yourself.",
				},
				{
					name: "filter",
					type: "(value: string, search: string, keywords?: string[]) => number",
					default: "computeCommandScore",
					description:
						"Custom scoring. Return a number between 0 and 1; 0 hides the item entirely.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "false",
					description: "Whether keyboard navigation wraps around at both ends.",
				},
				{
					name: "disablePointerSelection",
					type: "boolean",
					default: "false",
					description: "When true, moving the pointer over an item does not highlight it.",
				},
				{
					name: "vimBindings",
					type: "boolean",
					default: "true",
					description: "Ctrl+n/j/p/k (and ctrl+h/l in a grid) move the highlight.",
				},
				{
					name: "columns",
					type: "number | null | Readable<number | null>",
					default: "null",
					description:
						"The number of columns the items are laid out in. Turns on grid navigation; match it to your CSS layout.",
				},
				{
					name: "disableInitialScroll",
					type: "boolean",
					default: "false",
					description: "When true, the initial highlight is not scrolled into view.",
				},
			],
			dataAttributes: [{ name: "data-command-root", value: "Present" }],
		},
		{
			name: "CommandInput",
			element: "Input",
			description:
				'The search box. Sets role="combobox" with aria-activedescendant on the highlighted item; two-way binds the root\'s search.',
			dataAttributes: [{ name: "data-command-input", value: "Present" }],
		},
		{
			name: "CommandList",
			element: "Div",
			description:
				'The scrollable results region. Sets role="listbox". Give it a max height and overflow to make it scroll.',
			props: [
				{
					name: "label",
					type: "string",
					default: '"Suggestions"',
					description: "Accessible name for the listbox.",
				},
			],
			dataAttributes: [{ name: "data-command-list", value: "Present" }],
			cssVariables: [
				{
					name: "--ip-command-list-height",
					description:
						"The measured height of the viewport, written on the list. Animate the list's height with it.",
				},
			],
		},
		{
			name: "CommandViewport",
			element: "Div",
			description:
				"The list's sole child, wrapping all groups and items. Its measured height feeds --ip-command-list-height.",
			dataAttributes: [{ name: "data-command-viewport", value: "Present" }],
		},
		{
			name: "CommandEmpty",
			element: "Div",
			description: "Shown only when the search leaves no items visible.",
			props: [
				{
					name: "forceMount",
					type: "boolean",
					default: "false",
					description: "Render even while items match.",
				},
			],
			dataAttributes: [{ name: "data-command-empty", value: "Present" }],
		},
		{
			name: "CommandLoading",
			element: "Div",
			description: 'A progress region for async items. Sets role="progressbar".',
			props: [
				{
					name: "progress",
					type: "number | Readable<number>",
					default: "0",
					description: "Progress between 0 and 100.",
				},
			],
			dataAttributes: [{ name: "data-command-loading", value: "Present" }],
		},
		{
			name: "CommandGroup",
			element: "Div",
			description:
				"Wraps a heading and its items. Hidden once the search filters out every item inside it. In a grid, each group starts a new row.",
			props: [
				{
					name: "value",
					type: "string",
					description:
						"A unique value naming the group, used to sort groups by their best match. Defaults to the group's id.",
				},
				{
					name: "forceMount",
					type: "boolean",
					default: "false",
					description: "Keep the group while every item in it is filtered out.",
				},
			],
			dataAttributes: [{ name: "data-command-group", value: "Present" }],
		},
		{
			name: "CommandGroupHeading",
			element: "Div",
			description: "The group's visible name; the group's items point aria-labelledby at it.",
			dataAttributes: [{ name: "data-command-group-heading", value: "Present" }],
		},
		{
			name: "CommandGroupItems",
			element: "Div",
			description: 'The container for a group\'s items. Sets role="group".',
			dataAttributes: [{ name: "data-command-group-items", value: "Present" }],
		},
		{
			name: "CommandItem",
			element: "Div",
			description:
				'One choice. Sets role="option". Filtered and ranked against its value (or text content) plus keywords; hidden when its score is 0.',
			props: [
				{
					name: "value",
					type: "string",
					description:
						"A unique value used to filter and rank the item. Defaults to the item's text content; dynamic children need an explicit stable value.",
				},
				{
					name: "keywords",
					type: "string[]",
					description: "Extra terms the filter also scores.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents choosing the item; the keyboard skips it.",
				},
				{
					name: "onSelect",
					type: "() => void",
					description: "Runs when the item is chosen, by click or by Enter.",
				},
				{
					name: "forceMount",
					type: "boolean",
					default: "false",
					description: "Keep the item visible regardless of the search.",
				},
			],
			dataAttributes: [
				{ name: "data-command-item", value: "Present" },
				{ name: "data-selected", value: "Present on the highlighted item" },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-value", value: "The item's value" },
				{ name: "data-group", value: "The value of the group the item belongs to" },
			],
		},
		{
			name: "CommandLinkItem",
			element: "A",
			description:
				"A CommandItem that renders an anchor, for items that navigate. Enter clicks it, which follows the link.",
			props: [
				{
					name: "value",
					type: "string",
					description:
						"A unique value used to filter and rank the item. Defaults to the item's text content.",
				},
				{
					name: "keywords",
					type: "string[]",
					description: "Extra terms the filter also scores.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents choosing the item; the keyboard skips it.",
				},
				{
					name: "onSelect",
					type: "() => void",
					description: "Runs when the item is chosen, by click or by Enter.",
				},
			],
			dataAttributes: [
				{ name: "data-command-item", value: "Present" },
				{ name: "data-selected", value: "Present on the highlighted item" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "CommandSeparator",
			element: "Div",
			description: "A divider between groups. Hidden while a search is active.",
			props: [
				{
					name: "forceMount",
					type: "boolean",
					default: "false",
					description: "Keep the separator while searching.",
				},
			],
			dataAttributes: [{ name: "data-command-separator", value: "Present" }],
		},
	],
	calendar: [
		{
			name: "Calendar",
			element: "Div",
			description:
				'The root. Owns the selected value and the visible months, and calls its children render function with { months, weekdays }. Sets role="application" and a full aria-label.',
			props: [
				{
					name: "type",
					type: '"single" | "multiple"',
					default: '"single"',
					description: "Whether one date is selected, or several can be.",
				},
				{
					name: "value",
					type: "Signal<CalendarDate | null> | Signal<CalendarDate[]>",
					description:
						'The selection. CalendarDate | null when type is "single", CalendarDate[] when "multiple". Pass a signal to control it from outside.',
				},
				{
					name: "maxDays",
					type: "number",
					description:
						'Only for type "multiple": the most dates that can be selected. Exceeding it restarts the selection at the clicked date.',
				},
				{
					name: "onDateSelect",
					type: "() => void",
					description: "Runs after a date is selected (not after a deselection).",
				},
				...calendarSharedRootProps(),
			],
			dataAttributes: [
				{ name: "data-calendar-root", value: "Present" },
				{ name: "data-invalid", value: "Present when the value is disabled or unavailable" },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-readonly", value: "Present when readonly" },
			],
		},
		{
			name: "CalendarCell",
			element: "Td",
			description:
				'One grid cell. Sets role="gridcell" plus aria-selected/aria-disabled, and computes the day\'s state for everything inside it.',
			props: [
				{
					name: "date",
					type: "CalendarDate | Readable<CalendarDate>",
					required: true,
					description: "The date this cell renders.",
				},
				{
					name: "month",
					type: "CalendarDate | Month | Readable<CalendarDate | Month>",
					required: true,
					description:
						"The month whose grid the cell sits in — pass the render function's month straight through.",
				},
			],
			dataAttributes: calendarCellDataAttributes("calendar", "cell"),
		},
		{
			name: "CalendarDay",
			element: "Div",
			description:
				'The selectable day inside a cell. Sets role="button" with a full date label; renders the day number unless children are passed. The focused day is the calendar\'s one Tab stop.',
			dataAttributes: calendarCellDataAttributes("calendar", "day"),
		},
		...calendarParts("Calendar", "calendar"),
	],
	"range-calendar": [
		{
			name: "RangeCalendar",
			element: "Div",
			description:
				'The root. Owns the selected range and the visible months, and calls its children render function with { months, weekdays }. Sets role="application" and a full aria-label.',
			props: [
				{
					name: "value",
					type: "Signal<DateRange> | DateRange",
					default: "{ start: null, end: null }",
					description:
						"The selected range. Inverted writes are reordered. Pass a signal to control it from outside.",
				},
				{
					name: "minDays",
					type: "number",
					description: "The fewest days a range may span. Shorter picks restart the selection.",
				},
				{
					name: "maxDays",
					type: "number",
					description: "The most days a range may span. Longer picks restart the selection.",
				},
				{
					name: "excludeDisabled",
					type: "boolean",
					default: "false",
					description: "Clear the range if it would contain a disabled date.",
				},
				{
					name: "onRangeSelect",
					type: "() => void",
					description: "Runs after both ends of the range are selected.",
				},
				...calendarSharedRootProps(),
			],
			dataAttributes: [
				{ name: "data-range-calendar-root", value: "Present" },
				{
					name: "data-invalid",
					value: "Present when an end is disabled/unavailable or the range is inverted",
				},
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-readonly", value: "Present when readonly" },
			],
		},
		{
			name: "RangeCalendarCell",
			element: "Td",
			description:
				'One grid cell. Sets role="gridcell" plus aria-selected/aria-disabled, and computes the day\'s range state for everything inside it.',
			props: [
				{
					name: "date",
					type: "CalendarDate | Readable<CalendarDate>",
					required: true,
					description: "The date this cell renders.",
				},
				{
					name: "month",
					type: "CalendarDate | Month | Readable<CalendarDate | Month>",
					required: true,
					description:
						"The month whose grid the cell sits in — pass the render function's month straight through.",
				},
			],
			dataAttributes: [
				...calendarCellDataAttributes("range-calendar", "cell"),
				...rangeCellDataAttributes,
			],
		},
		{
			name: "RangeCalendarDay",
			element: "Div",
			description:
				'The selectable day inside a cell. Sets role="button" with a full date label; renders the day number unless children are passed. Hovering or focusing it drives the range highlight.',
			dataAttributes: [
				...calendarCellDataAttributes("range-calendar", "day"),
				...rangeCellDataAttributes,
			],
		},
		...calendarParts("RangeCalendar", "range-calendar"),
	],
	accordion: [
		{
			name: "Accordion",
			element: "Div",
			description: "The root. Owns which items are open and the arrow-key focus movement.",
			props: [
				{
					name: "type",
					type: '"single" | "multiple"',
					default: '"single"',
					description: "Whether opening an item closes the others, or several can stay open.",
				},
				{
					name: "value",
					type: "Signal<string | null> (single) | Signal<string[]> (multiple)",
					description:
						"The open item(s). Pass a signal to control the accordion from outside; omit it for uncontrolled state.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables every item in the accordion.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last trigger back to the first.",
				},
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"vertical"',
					description:
						"Which arrow keys move focus between triggers: vertical is Up/Down, horizontal is Left/Right.",
				},
			],
			dataAttributes: [
				{ name: "data-accordion-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "AccordionItem",
			element: "Div",
			description: "One section of the accordion.",
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the item. Must be unique within the accordion.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables this item.",
				},
			],
			dataAttributes: [
				{ name: "data-accordion-item", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
			],
		},
		{
			name: "AccordionTrigger",
			element: "Button",
			description: "Toggles its item open and closed.",
			props: [
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables this trigger.",
				},
			],
			dataAttributes: [
				{ name: "data-accordion-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-value", value: "The item's value" },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
			],
		},
		{
			name: "AccordionContent",
			element: "Div",
			description:
				"The body of an item. Hidden with the `hidden` attribute while closed; a close animation on it finishes before the attribute is set.",
			props: [
				{
					name: "hiddenUntilFound",
					type: "boolean",
					default: "false",
					description: 'Closed content uses hidden="until-found" so find-in-page can reveal it.',
				},
			],
			dataAttributes: [
				{ name: "data-accordion-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
			],
			cssVariables: [
				{
					name: "--ip-accordion-content-height",
					description: "The natural height of the content, for open/close animations.",
				},
				{
					name: "--ip-accordion-content-width",
					description: "The natural width of the content, for open/close animations.",
				},
			],
		},
		{
			name: "AccordionHeader",
			element: "Div",
			description: 'Wraps a trigger in role="heading" when the item title should be a heading.',
			props: [
				{
					name: "level",
					type: "1 | 2 | 3 | 4 | 5 | 6",
					default: "3",
					description: "The aria-level of the heading.",
				},
			],
			dataAttributes: [
				{ name: "data-accordion-header", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-heading-level", value: '"1" – "6"' },
			],
		},
	],
	collapsible: [
		{
			name: "Collapsible",
			element: "Div",
			description:
				"The root. Owns whether the content is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
			],
			dataAttributes: [
				{ name: "data-collapsible-root", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "CollapsibleTrigger",
			element: "Button",
			description: "Toggles the content open and closed.",
			dataAttributes: [
				{ name: "data-collapsible-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "CollapsibleContent",
			element: "Div",
			description:
				"The body. Hidden with the `hidden` attribute while closed; a close animation on it finishes before the attribute is set.",
			props: [
				{
					name: "hiddenUntilFound",
					type: "boolean",
					default: "false",
					description: 'Closed content uses hidden="until-found" so find-in-page can reveal it.',
				},
			],
			dataAttributes: [
				{ name: "data-collapsible-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
			cssVariables: [
				{
					name: "--ip-collapsible-content-height",
					description: "The natural height of the content, for open/close animations.",
				},
				{
					name: "--ip-collapsible-content-width",
					description: "The natural width of the content, for open/close animations.",
				},
			],
		},
	],
	avatar: [
		{
			name: "Avatar",
			element: "Div",
			description: "The root. Tracks the image's loading status for the parts inside it.",
			props: [
				{
					name: "delayMs",
					type: "number",
					default: "0",
					description:
						"How long to wait after the image loads before showing it, preventing a flash on fast connections.",
				},
				{
					name: "onLoadingStatusChange",
					type: "(status: AvatarLoadingStatus) => void",
					description: "Called whenever the loading status changes.",
				},
			],
			dataAttributes: [
				{ name: "data-avatar-root", value: "Present" },
				{ name: "data-status", value: '"loading" | "loaded" | "error"' },
			],
		},
		{
			name: "AvatarImage",
			element: "Img",
			description:
				"The picture. Preloaded off-DOM and only shown once loaded; a reactive src re-runs the load.",
			dataAttributes: [
				{ name: "data-avatar-image", value: "Present" },
				{ name: "data-status", value: '"loading" | "loaded" | "error"' },
			],
		},
		{
			name: "AvatarFallback",
			element: "Span",
			description: "Shown until the image has loaded — initials, an icon, anything.",
			dataAttributes: [
				{ name: "data-avatar-fallback", value: "Present" },
				{ name: "data-status", value: '"loading" | "loaded" | "error"' },
			],
		},
	],
	checkbox: [
		{
			name: "Checkbox",
			element: "Button",
			description:
				'A toggle that is checked, unchecked, or indeterminate. Sets role="checkbox" and aria-checked. Give it a look and an indicator; it handles the state.',
			props: [
				{
					name: "checked",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The checked state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "indeterminate",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						'Partial selection. While true, data-state is "indeterminate" and aria-checked is "mixed". A click clears it and checks the box.',
				},
				{
					name: "name",
					type: "string",
					description: "If set, a hidden checkbox is rendered so the value submits with a form.",
				},
				{
					name: "value",
					type: "string",
					default: '"on"',
					description: "The value submitted while checked. Only used when name is set.",
				},
				{
					name: "required",
					type: "boolean",
					default: "false",
					description: "Marks the hidden input as required. Sets aria-required on the button.",
				},
			],
			dataAttributes: [
				{ name: "data-checkbox-root", value: "Present" },
				{
					name: "data-state",
					value: '"checked" | "unchecked" | "indeterminate"',
				},
			],
		},
	],
	switch: [
		{
			name: "Switch",
			element: "Button",
			description:
				'A toggle that is on or off. Sets role="switch" and aria-checked. Give it a track and a thumb; it handles the state.',
			props: [
				{
					name: "checked",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The checked state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "name",
					type: "string",
					description: "If set, a hidden checkbox is rendered so the value submits with a form.",
				},
				{
					name: "value",
					type: "string",
					default: '"on"',
					description: "The value submitted while checked. Only used when name is set.",
				},
				{
					name: "required",
					type: "boolean",
					default: "false",
					description: "Marks the hidden input as required. Sets aria-required on the button.",
				},
			],
			dataAttributes: [
				{ name: "data-switch-root", value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked"' },
			],
		},
		{
			name: "SwitchThumb",
			element: "Span",
			description: "The knob. Put it inside the switch and slide it with data-state.",
			dataAttributes: [
				{ name: "data-switch-thumb", value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked"' },
			],
		},
	],
	meter: [
		{
			name: "Meter",
			element: "Div",
			description:
				'A static measurement within a known range. Sets role="meter" and the aria value attributes. Give it a track and a fill; it handles the semantics.',
			props: [
				{
					name: "value",
					type: "Signal<number> | number",
					default: "0",
					description:
						"The current value. Pass a signal to control it from outside; a number seeds uncontrolled state.",
				},
				{
					name: "min",
					type: "Signal<number> | number",
					default: "0",
					description: "The lowest value the meter can take.",
				},
				{
					name: "max",
					type: "Signal<number> | number",
					default: "100",
					description: "The highest value the meter can take.",
				},
			],
			dataAttributes: [
				{ name: "data-meter-root", value: "Present" },
				{ name: "data-value", value: "The current value" },
				{ name: "data-min", value: "The minimum value" },
				{ name: "data-max", value: "The maximum value" },
			],
		},
	],
	progress: [
		{
			name: "Progress",
			element: "Div",
			description:
				'Completion status of a task. Sets role="progressbar" and the aria value attributes. Give it a track and a fill; it handles the semantics.',
			props: [
				{
					name: "value",
					type: "Signal<number | null> | number | null",
					default: "0",
					description:
						"The current value; null renders an indeterminate bar. Pass a signal to control it from outside; a number seeds uncontrolled state.",
				},
				{
					name: "min",
					type: "Signal<number> | number",
					default: "0",
					description: "The value the bar starts from.",
				},
				{
					name: "max",
					type: "Signal<number> | number",
					default: "100",
					description: "The value at which the task is complete.",
				},
			],
			dataAttributes: [
				{ name: "data-progress-root", value: "Present" },
				{ name: "data-state", value: '"loading" | "loaded" | "indeterminate"' },
				{
					name: "data-value",
					value: "The current value; absent while indeterminate",
				},
				{ name: "data-min", value: "The minimum value" },
				{ name: "data-max", value: "The maximum value" },
				{
					name: "data-indeterminate",
					value: "Present while the value is null",
				},
			],
		},
	],
	toggle: [
		{
			name: "Toggle",
			element: "Button",
			description:
				"A two-state button that can be on or off. Sets aria-pressed. Give it a look and children; it handles the state.",
			props: [
				{
					name: "pressed",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The pressed state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents toggling. Sets the native disabled attribute and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-toggle-root", value: "Present" },
				{ name: "data-state", value: '"on" | "off"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
	],
	"dropdown-menu": [
		{
			name: "DropdownMenu",
			description:
				"The root. Owns whether the menu is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while the menu is open. The panel can still scroll if you give it overflow.",
				},
			],
		},
		{
			name: "DropdownMenuTrigger",
			element: "Button",
			description:
				"Opens the menu on click, Enter, Space, or ArrowDown. Sets aria-haspopup, aria-expanded, and aria-controls.",
			props: [
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents opening the menu. Sets disabled and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-dropdown-menu-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		...menuParts("DropdownMenu", "dropdown-menu"),
	],
	"context-menu": [
		{
			name: "ContextMenu",
			description:
				"The root. Owns whether the menu is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while the menu is open. The panel can still scroll if you give it overflow.",
				},
			],
		},
		{
			name: "ContextMenuTrigger",
			element: "Div",
			description:
				"The area the menu belongs to. Right-clicking (or long-pressing on touch) opens the menu at the pointer.",
			props: [
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Falls back to the native browser menu.",
				},
			],
			dataAttributes: [
				{ name: "data-context-menu-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		...menuParts("ContextMenu", "context-menu"),
	],
	menubar: [
		{
			name: "Menubar",
			element: "Div",
			description:
				'The bar. Sets role="menubar", owns which menu is open, and moves focus between the triggers.',
			props: [
				{
					name: "value",
					type: "Signal<string | null> | string | null",
					default: "null",
					description:
						"The open menu's value, or null while all are closed. Pass a signal to control it from outside.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last trigger back to the first.",
				},
			],
			dataAttributes: [
				{ name: "data-menubar-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal"' },
			],
		},
		{
			name: "MenubarMenu",
			description: "One menu of the bar. Wraps a trigger and its content.",
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the menu. Must be unique within the menubar.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while this menu is open. The panel can still scroll if you give it overflow.",
				},
			],
		},
		{
			name: "MenubarTrigger",
			element: "Button",
			description:
				'The menu\'s button in the bar. Sets role="menuitem"; hovering it switches to this menu while another is open.',
			props: [
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents opening the menu. Sets disabled and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-menubar-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-highlighted", value: "Present while focused" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		...menuParts("Menubar", "menubar"),
	],
	tabs: [
		{
			name: "Tabs",
			element: "Div",
			description:
				"The root. Owns the selected value, the activation mode, and the arrow-key focus movement.",
			props: [
				{
					name: "value",
					type: "Signal<string> | string",
					default: '""',
					description:
						"The selected tab. Pass a signal to control it from outside; a string seeds uncontrolled state. Empty means nothing is selected.",
				},
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"horizontal"',
					description: "Which arrow keys move focus, and the data-orientation attributes.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last trigger back to the first.",
				},
				{
					name: "activationMode",
					type: '"automatic" | "manual"',
					default: '"automatic"',
					description:
						"Whether focusing a trigger selects its tab, or selection waits for a click or Space/Enter.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables every trigger.",
				},
			],
			dataAttributes: [
				{ name: "data-tabs-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "TabsList",
			element: "Div",
			description: 'Holds the triggers. Sets role="tablist" and aria-orientation.',
			props: [],
			dataAttributes: [
				{ name: "data-tabs-list", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when the root is disabled" },
			],
		},
		{
			name: "TabsTrigger",
			element: "Button",
			description:
				'One tab. Sets role="tab", aria-selected, and aria-controls pointing at the matching content.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the tab. Must match the TabsContent it opens.",
				},
				{
					name: "id",
					type: "string",
					description:
						"Defaults to a generated id. The matching panel points back at it with aria-labelledby.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents selecting the tab. Sets disabled and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-tabs-trigger", value: "Present" },
				{ name: "data-state", value: '"active" | "inactive"' },
				{ name: "data-value", value: "The tab's value" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "TabsContent",
			element: "Div",
			description:
				'The panel for one tab. Sets role="tabpanel", is labelled by its trigger, and is hidden unless selected.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the panel. Must match the TabsTrigger that opens it.",
				},
				{
					name: "id",
					type: "string",
					description:
						"Defaults to a generated id. The matching trigger points at it with aria-controls.",
				},
			],
			dataAttributes: [
				{ name: "data-tabs-content", value: "Present" },
				{ name: "data-state", value: '"active" | "inactive"' },
				{ name: "data-value", value: "The tab's value" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
			],
		},
	],
	"toggle-group": [
		{
			name: "ToggleGroup",
			element: "Div",
			description:
				'The root. Owns which items are pressed and the arrow-key focus movement. Sets role="group".',
			props: [
				{
					name: "type",
					type: '"single" | "multiple"',
					default: '"single"',
					description: "Whether pressing an item releases the others, or several can stay on.",
				},
				{
					name: "value",
					type: "Signal<string | null> | Signal<string[]>",
					description:
						'The pressed value(s). string | null when type is "single", string[] when "multiple". Pass a signal to control it from outside.',
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables every item in the group.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last item back to the first.",
				},
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"horizontal"',
					description: "Which arrow keys move focus, and the data-orientation attributes.",
				},
			],
			dataAttributes: [
				{ name: "data-toggle-group-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "ToggleGroupItem",
			element: "Button",
			description:
				'One toggle. role="radio" with aria-checked in a single group, aria-pressed in a multiple group.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the item. Must be unique within the group.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents pressing the item. Sets disabled and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-toggle-group-item", value: "Present" },
				{ name: "data-state", value: '"on" | "off"' },
				{ name: "data-value", value: "The item's value" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
	],
	"radio-group": [
		{
			name: "RadioGroup",
			element: "Div",
			description:
				'The root. Owns which item is checked and the arrow-key focus movement. Sets role="radiogroup".',
			props: [
				{
					name: "value",
					type: "Signal<string | null> | string | null",
					default: "null",
					description:
						"The checked item. Pass a signal to control it from outside; a string seeds uncontrolled state.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Disables every item in the group.",
				},
				{
					name: "required",
					type: "boolean",
					default: "false",
					description: "Sets aria-required on the group.",
				},
				{
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last item back to the first.",
				},
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"vertical"',
					description: "Announced to assistive technology and set as data-orientation.",
				},
			],
			dataAttributes: [
				{ name: "data-radio-group-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "RadioGroupItem",
			element: "Button",
			description:
				'One option. Sets role="radio" and aria-checked; arrowing to it checks it. Give it a look and an indicator.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the item. Must be unique within the group.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents checking the item. Sets disabled and data-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-radio-group-item", value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked"' },
				{ name: "data-value", value: "The item's value" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
	],
	"rating-group": [
		{
			name: "RatingGroup",
			element: "Div",
			description:
				'The root and the single focusable control. Announces as a slider: role="slider" with the aria value attributes.',
			props: [
				{
					name: "value",
					type: "Signal<number> | number",
					default: "0",
					description:
						"The current rating. Pass a signal to control it from outside; a number seeds uncontrolled state.",
				},
				{
					name: "min",
					type: "number",
					default: "0",
					description: "The lowest value the rating can take.",
				},
				{
					name: "max",
					type: "number",
					default: "5",
					description: "The highest value the rating can take.",
				},
				{
					name: "allowHalf",
					type: "boolean",
					default: "false",
					description: "Work in half steps: pointer position picks the half, arrows move by 0.5.",
				},
				{
					name: "readonly",
					type: "boolean",
					default: "false",
					description: "The value can be read but not changed.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents changes and removes the group from the Tab order.",
				},
				{
					name: "hoverPreview",
					type: "boolean",
					default: "true",
					description: "Preview the value under the pointer before clicking.",
				},
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"horizontal"',
					description: "The axis pointer positions are measured along for half steps.",
				},
				{
					name: "required",
					type: "boolean",
					default: "false",
					description: "Sets aria-required on the group.",
				},
			],
			dataAttributes: [
				{ name: "data-rating-group-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-readonly", value: "Present when readonly" },
			],
		},
		{
			name: "RatingGroupItem",
			element: "Div",
			description:
				'One visual step. role="presentation" — the root carries the semantics. Fill it with an icon and style against data-state.',
			props: [
				{
					name: "index",
					type: "number",
					required: true,
					description: "Zero-based position; the item represents the rating index + 1.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Ignores pointer input on this item.",
				},
			],
			dataAttributes: [
				{ name: "data-rating-group-item", value: "Present" },
				{ name: "data-state", value: '"active" | "partial" | "inactive"' },
				{ name: "data-value", value: "The rating the item represents" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
				{ name: "data-disabled", value: "Present when disabled" },
				{ name: "data-readonly", value: "Present when readonly" },
			],
		},
	],
	"aspect-ratio": [
		{
			name: "AspectRatio",
			element: "Div",
			description:
				"Constrains content to a width / height ratio. Renders a sized wrapper around the root your props and children land on.",
			props: [
				{
					name: "ratio",
					type: "Signal<number> | number",
					default: "1",
					description: "Width divided by height, e.g. 16 / 9.",
				},
			],
			dataAttributes: [{ name: "data-aspect-ratio-root", value: "Present" }],
		},
	],
	separator: [
		{
			name: "Separator",
			element: "Div",
			description: "A line between things. Give it a size and color; it handles the semantics.",
			props: [
				{
					name: "orientation",
					type: '"horizontal" | "vertical"',
					default: '"horizontal"',
					description: "The direction the separator divides content in.",
				},
				{
					name: "decorative",
					type: "boolean",
					default: "false",
					description:
						'Purely visual separators render role="none" and are hidden from assistive technology.',
				},
			],
			dataAttributes: [
				{ name: "data-separator-root", value: "Present" },
				{ name: "data-orientation", value: '"horizontal" | "vertical"' },
			],
		},
	],
	"link-preview": [
		{
			name: "LinkPreview",
			description:
				"The root. Owns whether the preview is open, the hover delays, and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while the preview is open. The panel can still scroll if you give it overflow.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "While true the preview never opens. The link still navigates.",
				},
				{
					name: "openDelay",
					type: "number",
					default: "700",
					description:
						"How long the pointer must rest on the link before the preview opens, in milliseconds.",
				},
				{
					name: "closeDelay",
					type: "number",
					default: "300",
					description:
						"How long the preview stays up after the pointer leaves, in milliseconds. This is the window the pointer has to travel from the link to the preview.",
				},
			],
		},
		{
			name: "LinkPreviewTrigger",
			element: "A",
			description:
				"The link the preview hangs off. Renders an anchor, so pass href and it navigates like any other link; hovering or keyboard-focusing it opens the preview.",
			dataAttributes: [
				{ name: "data-link-preview-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "LinkPreviewContent",
			element: "Div",
			description:
				"The preview panel. Style it against data-state and data-side; the primitive does not hide it for you.",
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"top"',
					description: "Preferred side of the link to place the panel.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"center"',
					description: "How the panel aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the link and the panel.",
				},
			],
			dataAttributes: [
				{ name: "data-link-preview-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
			cssVariables: [
				{
					name: "--ip-link-preview-content-transform-origin",
					description: "The transform origin of the content element.",
				},
				{
					name: "--ip-link-preview-content-available-width",
					description: "The available width of the content element.",
				},
				{
					name: "--ip-link-preview-content-available-height",
					description: "The available height of the content element.",
				},
				{
					name: "--ip-link-preview-anchor-width",
					description: "The width of the anchor element.",
				},
				{
					name: "--ip-link-preview-anchor-height",
					description: "The height of the anchor element.",
				},
			],
		},
		{
			name: "LinkPreviewPortal",
			description:
				"Renders its children into another DOM parent so the panel escapes overflow and stacking. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Readable<HTMLElement>",
					default: "document.body",
					description: "The element to mount into. Also available as chained .To(target).",
				},
				{
					name: "disabled",
					type: "boolean | Readable<boolean>",
					default: "false",
					description:
						"Mount in place instead of teleporting. Also available as chained .Disabled(value).",
				},
			],
		},
	],
	tooltip: [
		{
			name: "TooltipProvider",
			description:
				"Shares timing across every tooltip inside it: one open at a time, and moving between triggers within skipDelayDuration skips the open delay. Optional — a Tooltip without one uses these defaults.",
			props: [
				{
					name: "delayDuration",
					type: "number",
					default: "700",
					description:
						"How long the pointer must rest on a trigger before the tooltip opens, in milliseconds.",
				},
				{
					name: "skipDelayDuration",
					type: "number",
					default: "300",
					description:
						"After a tooltip closes, how long another trigger opens instantly instead of waiting through the delay again, in milliseconds.",
				},
				{
					name: "disableHoverableContent",
					type: "boolean",
					default: "false",
					description:
						"Close as soon as the pointer leaves the trigger instead of letting it travel to the content.",
				},
				{
					name: "disableCloseOnTriggerClick",
					type: "boolean",
					default: "false",
					description: "Keep the tooltip open when the trigger is clicked.",
				},
				{
					name: "disabled",
					type: "boolean",
					default: "false",
					description: "Disables every tooltip under the provider.",
				},
				{
					name: "ignoreNonKeyboardFocus",
					type: "boolean",
					default: "false",
					description:
						"Only open on focus when the focus is keyboard-driven (matches :focus-visible).",
				},
			],
		},
		{
			name: "Tooltip",
			description:
				"The root. Owns whether the tooltip is open and provides that to the parts inside it. The timing props default to the provider's values.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "delayDuration",
					type: "number",
					description: "Overrides the provider's delayDuration for this tooltip.",
				},
				{
					name: "disableHoverableContent",
					type: "boolean",
					description: "Overrides the provider's disableHoverableContent for this tooltip.",
				},
				{
					name: "disableCloseOnTriggerClick",
					type: "boolean",
					description: "Overrides the provider's disableCloseOnTriggerClick for this tooltip.",
				},
				{
					name: "disabled",
					type: "boolean",
					description: "Overrides the provider's disabled for this tooltip.",
				},
				{
					name: "ignoreNonKeyboardFocus",
					type: "boolean",
					description: "Overrides the provider's ignoreNonKeyboardFocus for this tooltip.",
				},
			],
		},
		{
			name: "TooltipTrigger",
			element: "Button",
			description:
				"Opens the tooltip on hover after the delay, or instantly on keyboard focus. Clicking closes it. While open it points at the content with aria-describedby.",
			props: [
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "While true this trigger never opens the tooltip.",
				},
			],
			dataAttributes: [
				{ name: "data-tooltip-trigger", value: "Present" },
				{
					name: "data-state",
					value: '"delayed-open" | "instant-open" | "closed"',
				},
				{ name: "data-disabled", value: "Present when disabled" },
				{
					name: "data-delay-duration",
					value: "The resolved open delay in milliseconds",
				},
			],
		},
		{
			name: "TooltipContent",
			element: "Div",
			description:
				'The bubble. Sets role="tooltip". Style it against data-state and data-side; the primitive does not hide it for you.',
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"top"',
					description: "Preferred side of the trigger to place the bubble.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"center"',
					description: "How the bubble aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the trigger and the bubble.",
				},
			],
			dataAttributes: [
				{ name: "data-tooltip-content", value: "Present" },
				{
					name: "data-state",
					value: '"delayed-open" | "instant-open" | "closed"',
				},
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
			cssVariables: [
				{
					name: "--ip-tooltip-content-transform-origin",
					description: "The transform origin of the content element.",
				},
				{
					name: "--ip-tooltip-content-available-width",
					description: "The available width of the content element.",
				},
				{
					name: "--ip-tooltip-content-available-height",
					description: "The available height of the content element.",
				},
				{
					name: "--ip-tooltip-anchor-width",
					description: "The width of the anchor element.",
				},
				{
					name: "--ip-tooltip-anchor-height",
					description: "The height of the anchor element.",
				},
			],
		},
		{
			name: "TooltipPortal",
			description:
				"Renders its children into another DOM parent so the bubble escapes overflow and stacking. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Readable<HTMLElement>",
					default: "document.body",
					description: "The element to mount into. Also available as chained .To(target).",
				},
				{
					name: "disabled",
					type: "boolean | Readable<boolean>",
					default: "false",
					description:
						"Mount in place instead of teleporting. Also available as chained .Disabled(value).",
				},
			],
		},
	],
	popover: [
		{
			name: "Popover",
			description:
				"The root. Owns whether the popover is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "false",
					description:
						"When true, the page behind cannot scroll while the popover is open. The panel can still scroll if you give it overflow.",
				},
			],
		},
		{
			name: "PopoverTrigger",
			element: "Button",
			description:
				"Toggles the popover open and closed. Clicking a different trigger moves the panel.",
			props: [
				{
					name: "default",
					type: "boolean",
					default: "false",
					description:
						"When the popover starts open, anchor to this trigger instead of the first one in the tree.",
				},
			],
			dataAttributes: [{ name: "data-state", value: '"open" | "closed"' }],
		},
		{
			name: "PopoverContent",
			element: "Div",
			description:
				"The panel. Style it against data-state and data-side; the primitive does not hide it for you.",
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"bottom"',
					description: "Preferred side of the trigger to place the panel.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"start"',
					description: "How the panel aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the trigger and the panel.",
				},
			],
			dataAttributes: [
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
			cssVariables: [
				{
					name: "--bits-popover-content-transform-origin",
					description: "The transform origin of the content element.",
				},
				{
					name: "--bits-popover-content-available-width",
					description: "The available width of the content element.",
				},
				{
					name: "--bits-popover-content-available-height",
					description: "The available height of the content element.",
				},
				{
					name: "--bits-popover-anchor-width",
					description: "The width of the anchor element.",
				},
				{
					name: "--bits-popover-anchor-height",
					description: "The height of the anchor element.",
				},
			],
		},
		{
			name: "PopoverPortal",
			description:
				"Renders its children into another DOM parent so the panel escapes overflow and stacking. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Readable<HTMLElement>",
					default: "document.body",
					description: "The element to mount into. Also available as chained .To(target).",
				},
				{
					name: "disabled",
					type: "boolean | Readable<boolean>",
					default: "false",
					description:
						"Mount in place instead of teleporting. Disable the inner portal on a nested popover so it stays in the outer overlay. Also available as chained .Disabled(value).",
				},
			],
		},
		{
			name: "PopoverClose",
			element: "Button",
			description: "Closes the popover when clicked. Put it inside the content.",
		},
	],
	dialog: [
		{
			name: "Dialog",
			description:
				"The root. Owns whether the dialog is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while the dialog is open. The overlay and panel can still scroll if you give them overflow.",
				},
			],
		},
		{
			name: "DialogTrigger",
			element: "Button",
			description:
				"Toggles the dialog open and closed. Clicking a different trigger keeps it open and remembers that button for focus return.",
			props: [
				{
					name: "default",
					type: "boolean",
					default: "false",
					description:
						"When the dialog starts open, return focus to this trigger instead of the first one in the tree.",
				},
			],
			dataAttributes: [
				{ name: "data-dialog-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "DialogOverlay",
			element: "Div",
			description:
				"The backdrop behind the panel. Style it against data-state; the primitive does not hide it for you.",
			dataAttributes: [
				{ name: "data-dialog-overlay", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-nested", value: "Present when this dialog is nested in another" },
				{ name: "data-nested-open", value: "Present when a nested dialog is open" },
				{ name: "data-nested-count", value: "Number of open nested dialogs" },
				{ name: "data-nested-level", value: "Depth in the stack; 0 is the outermost dialog" },
			],
			cssVariables: [
				{
					name: "--ip-nested-count",
					description:
						"How many nested dialogs are open above this one. Use it to scale or translate the parent in a stack, e.g. scale(calc(1 - 0.05 * var(--ip-nested-count))).",
				},
				{
					name: "--ip-nested-level",
					description:
						"This dialog's depth in the stack, 0 for the outermost. Raise z-index with it so nested dialogs paint above their parent, e.g. z-index: calc(50 + var(--ip-nested-level)).",
				},
			],
		},
		{
			name: "DialogContent",
			element: "Div",
			description:
				'The panel. Sets role="dialog" and aria-modal. Style it against data-state; the primitive does not hide or position it for you.',
			dataAttributes: [
				{ name: "data-dialog-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-nested", value: "Present when this dialog is nested in another" },
				{ name: "data-nested-open", value: "Present when a nested dialog is open" },
				{ name: "data-nested-count", value: "Number of open nested dialogs" },
				{ name: "data-nested-level", value: "Depth in the stack; 0 is the outermost dialog" },
			],
			cssVariables: [
				{
					name: "--ip-nested-count",
					description:
						"How many nested dialogs are open above this one. Use it to scale or translate the parent in a stack, e.g. scale(calc(1 - 0.05 * var(--ip-nested-count))).",
				},
				{
					name: "--ip-nested-level",
					description:
						"This dialog's depth in the stack, 0 for the outermost. Raise z-index with it so nested dialogs paint above their parent, e.g. z-index: calc(50 + var(--ip-nested-level)).",
				},
			],
		},
		{
			name: "DialogTitle",
			element: "H2",
			description: "The heading. Put it inside the content. Wires up aria-labelledby on the panel.",
			dataAttributes: [{ name: "data-dialog-title", value: "Present" }],
		},
		{
			name: "DialogDescription",
			element: "P",
			description:
				"Supporting text. Put it inside the content. Wires up aria-describedby on the panel.",
			dataAttributes: [{ name: "data-dialog-description", value: "Present" }],
		},
		{
			name: "DialogPortal",
			description:
				"Renders its children into another DOM parent so the overlay and panel escape overflow and stacking. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Readable<HTMLElement>",
					default: "document.body",
					description: "The element to mount into. Also available as chained .To(target).",
				},
				{
					name: "disabled",
					type: "boolean | Readable<boolean>",
					default: "false",
					description:
						"Mount in place instead of teleporting. Keep nested dialogs portaled so they stack above the parent. Also available as chained .Disabled(value).",
				},
			],
		},
		{
			name: "DialogClose",
			element: "Button",
			description: "Closes the dialog when clicked. Put it inside the content.",
		},
	],
	"alert-dialog": [
		{
			name: "AlertDialog",
			description:
				"The root. Owns whether the alert dialog is open and provides that to the parts inside it.",
			props: [
				{
					name: "open",
					type: "Signal<boolean> | boolean",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; a boolean seeds uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "true",
					description:
						"When true, the page behind cannot scroll while the alert dialog is open. The overlay and panel can still scroll if you give them overflow.",
				},
			],
		},
		{
			name: "AlertDialogTrigger",
			element: "Button",
			description:
				"Toggles the alert dialog open and closed. Clicking a different trigger keeps it open and remembers that button for focus return.",
			props: [
				{
					name: "default",
					type: "boolean",
					default: "false",
					description:
						"When the alert dialog starts open, return focus to this trigger instead of the first one in the tree.",
				},
			],
			dataAttributes: [
				{ name: "data-alert-dialog-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "AlertDialogOverlay",
			element: "Div",
			description:
				"The backdrop behind the panel. Style it against data-state; the primitive does not hide it for you.",
			dataAttributes: [
				{ name: "data-alert-dialog-overlay", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-nested", value: "Present when this dialog is nested in another" },
				{ name: "data-nested-open", value: "Present when a nested dialog is open" },
				{ name: "data-nested-count", value: "Number of open nested dialogs" },
				{ name: "data-nested-level", value: "Depth in the stack; 0 is the outermost dialog" },
			],
			cssVariables: [
				{
					name: "--ip-nested-count",
					description:
						"How many nested dialogs are open above this one. Use it to scale or translate the parent in a stack, e.g. scale(calc(1 - 0.05 * var(--ip-nested-count))).",
				},
				{
					name: "--ip-nested-level",
					description:
						"This dialog's depth in the stack, 0 for the outermost. Raise z-index with it so nested dialogs paint above their parent, e.g. z-index: calc(50 + var(--ip-nested-level)).",
				},
			],
		},
		{
			name: "AlertDialogContent",
			element: "Div",
			description:
				'The panel. Sets role="alertdialog" and aria-modal. Clicking outside does not dismiss it; Escape still cancels. Style it against data-state; the primitive does not hide or position it for you.',
			dataAttributes: [
				{ name: "data-alert-dialog-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-nested", value: "Present when this dialog is nested in another" },
				{ name: "data-nested-open", value: "Present when a nested dialog is open" },
				{ name: "data-nested-count", value: "Number of open nested dialogs" },
				{ name: "data-nested-level", value: "Depth in the stack; 0 is the outermost dialog" },
			],
			cssVariables: [
				{
					name: "--ip-nested-count",
					description:
						"How many nested dialogs are open above this one. Use it to scale or translate the parent in a stack, e.g. scale(calc(1 - 0.05 * var(--ip-nested-count))).",
				},
				{
					name: "--ip-nested-level",
					description:
						"This dialog's depth in the stack, 0 for the outermost. Raise z-index with it so nested dialogs paint above their parent, e.g. z-index: calc(50 + var(--ip-nested-level)).",
				},
			],
		},
		{
			name: "AlertDialogTitle",
			element: "H2",
			description: "The heading. Put it inside the content. Wires up aria-labelledby on the panel.",
			dataAttributes: [{ name: "data-alert-dialog-title", value: "Present" }],
		},
		{
			name: "AlertDialogDescription",
			element: "P",
			description:
				"Supporting text. Put it inside the content. Wires up aria-describedby on the panel.",
			dataAttributes: [{ name: "data-alert-dialog-description", value: "Present" }],
		},
		{
			name: "AlertDialogPortal",
			description:
				"Renders its children into another DOM parent so the overlay and panel escape overflow and stacking. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Readable<HTMLElement>",
					default: "document.body",
					description: "The element to mount into. Also available as chained .To(target).",
				},
				{
					name: "disabled",
					type: "boolean | Readable<boolean>",
					default: "false",
					description:
						"Mount in place instead of teleporting. Keep nested dialogs portaled so they stack above the parent. Also available as chained .Disabled(value).",
				},
			],
		},
		{
			name: "AlertDialogCancel",
			element: "Button",
			description:
				"Closes without confirming. Receives focus when the alert dialog opens, so Enter or Space backs out instead of confirming.",
			dataAttributes: [{ name: "data-alert-dialog-cancel", value: "Present" }],
		},
		{
			name: "AlertDialogAction",
			element: "Button",
			description: "Confirms and closes when clicked. Attach the actual work to onClick.",
			dataAttributes: [{ name: "data-alert-dialog-action", value: "Present" }],
		},
	],
	select: [
		{
			name: "Select",
			description:
				"The root. Owns whether the list is open, which values are selected, and provides that to the parts inside it.",
			props: [
				{
					name: "type",
					type: '"single" | "multiple"',
					default: '"single"',
					description: "Whether choosing an item replaces the value, or several can stay selected.",
				},
				{
					name: "value",
					type: "Signal<string | null> | Signal<string[]>",
					description:
						'The selected value. string | null when type is "single", string[] when "multiple". Pass a signal to control it from outside.',
				},
				{
					name: "open",
					type: "Signal<boolean>",
					default: "false",
					description:
						"The open state. Pass a signal to control it from outside; omit it for uncontrolled state.",
				},
				{
					name: "preventScroll",
					type: "boolean",
					default: "false",
					description:
						"When true, the page behind cannot scroll while the list is open. The list can still scroll if you give it overflow.",
				},
				{
					name: "items",
					type: "SelectItemData[] | Readable<SelectItemData[]>",
					description:
						"Value/label pairs for SelectValue. When omitted, labels come from each item's label prop or its text content.",
				},
			],
		},
		{
			name: "SelectTrigger",
			element: "Button",
			description: "Toggles the list open and closed.",
			dataAttributes: [{ name: "data-state", value: '"open" | "closed"' }],
		},
		{
			name: "SelectValue",
			description:
				"The selected label. Put it inside the trigger. Uses items on the root when provided, otherwise each option's label or text.",
			props: [
				{
					name: "placeholder",
					type: "string",
					default: '""',
					description: "Shown when nothing is selected.",
				},
				{
					name: "render",
					type: "(props: SelectValueRenderProps) => Child",
					description:
						"Called with the current selection. Discriminate on props.type: value is the stored ids, selected is { value, label } (or an array of those). Omit it to show the label, or a comma-separated list.",
				},
			],
		},
		{
			name: "SelectContent",
			element: "Div",
			description:
				'The list. Sets role="listbox". Style it against data-state and data-side; the primitive does not hide it for you.',
			props: [
				{
					name: "side",
					type: '"top" | "bottom" | "left" | "right"',
					default: '"bottom"',
					description: "Preferred side of the trigger to place the list.",
				},
				{
					name: "align",
					type: '"start" | "center" | "end"',
					default: '"start"',
					description: "How the list aligns along the chosen side.",
				},
				{
					name: "offset",
					type: "number",
					default: "0",
					description: "Distance in pixels between the trigger and the list.",
				},
			],
			dataAttributes: [
				{ name: "data-select-content", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-side", value: '"top" | "bottom" | "left" | "right"' },
				{ name: "data-align", value: '"start" | "center" | "end"' },
			],
			cssVariables: [
				{
					name: "--ip-select-content-transform-origin",
					description: "The transform origin of the content element.",
				},
				{
					name: "--ip-select-content-available-width",
					description: "The available width of the content element.",
				},
				{
					name: "--ip-select-content-available-height",
					description: "The available height of the content element.",
				},
				{
					name: "--ip-select-anchor-width",
					description: "The width of the trigger.",
				},
				{
					name: "--ip-select-anchor-height",
					description: "The height of the trigger.",
				},
			],
		},
		{
			name: "SelectItem",
			element: "Div",
			description: 'One option. Sets role="option" and aria-selected.',
			props: [
				{
					name: "value",
					type: "string",
					required: true,
					description: "Identifies the item. Must be unique within the select.",
				},
				{
					name: "label",
					type: "string",
					description:
						"Display and typeahead text. Defaults to the item's text content, or the matching entry in items.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Prevents selecting the item. Sets data-disabled and aria-disabled.",
				},
			],
			dataAttributes: [
				{ name: "data-select-item", value: "Present" },
				{ name: "data-selected", value: "Present when selected" },
				{ name: "data-highlighted", value: "Present when highlighted" },
				{ name: "data-disabled", value: "Present when disabled" },
			],
		},
		{
			name: "SelectGroup",
			element: "Div",
			description: 'Wraps related items in role="group", labeled by the heading placed inside it.',
			dataAttributes: [{ name: "data-select-group", value: "Present" }],
		},
		{
			name: "SelectGroupHeading",
			element: "Div",
			description: "Names the group it sits in; the group points aria-labelledby at it.",
			dataAttributes: [{ name: "data-select-group-heading", value: "Present" }],
		},
	],
	"mode-watcher": [
		{
			name: "createModeManager",
			description:
				"Creates the ModeManager that owns the mode. mode, userPrefersMode, systemPrefersMode, and theme are readables; setMode, toggleMode, resetMode, and setTheme change them. Usually created at module scope so any code can flip the mode. Nothing reaches the DOM until a mounted ModeWatcher starts it.",
			props: [
				{
					name: "defaultMode",
					type: '"dark" | "light" | "system"',
					default: '"system"',
					description: "The mode to use until the visitor picks one.",
				},
				{
					name: "defaultTheme",
					type: "string",
					default: '""',
					description: "The data-theme value to use until one is set. Empty means no attribute.",
				},
				{
					name: "darkClassNames",
					type: "string[]",
					default: '["dark"]',
					description: "Classes put on the html element in dark mode.",
				},
				{
					name: "lightClassNames",
					type: "string[]",
					default: "[]",
					description: "Classes put on the html element in light mode.",
				},
				{
					name: "themeColors",
					type: "{ dark: string; light: string }",
					description: "Keeps meta[name=theme-color] in step with the mode.",
				},
				{
					name: "modeStorageKey",
					type: "string",
					default: '"implement-mode"',
					description: "localStorage key holding the picked mode.",
				},
				{
					name: "themeStorageKey",
					type: "string",
					default: '"implement-theme"',
					description: "localStorage key holding the theme.",
				},
				{
					name: "disableTransitions",
					type: "boolean",
					default: "true",
					description: "Suppresses CSS transitions while the mode swaps, so colors don't smear.",
				},
				{
					name: "track",
					type: "boolean",
					default: "true",
					description:
						"Whether to follow prefers-color-scheme as it changes. False keeps the first reading.",
				},
			],
		},
		{
			name: "ModeWatcher",
			description:
				"Mounted once at the root. Renders a blocking script into the head so the stored mode lands on the html element before the first paint, then applies the manager's mode — classes, color-scheme, data-theme, and the theme-color meta — for as long as it stays mounted. Takes every createModeManager option, applying them to the manager it is given or to the one it makes.",
			props: [
				{
					name: "manager",
					type: "ModeManager",
					description:
						"A manager from createModeManager(). Omitted, the component creates a private one.",
				},
				{
					name: "injectScript",
					type: "boolean",
					default: "true",
					description:
						"Whether to add the blocking script. False when it is injected elsewhere with createInitialModeExpression.",
				},
				{
					name: "nonce",
					type: "string",
					description: "nonce for the injected script, for pages under a Content Security Policy.",
				},
			],
			dataAttributes: [
				{ name: "class", value: "darkClassNames or lightClassNames, on the html element" },
				{ name: "style", value: "color-scheme: dark | light, on the html element" },
				{ name: "data-theme", value: "The current theme, when it is not empty" },
			],
		},
		{
			name: "createInitialModeExpression",
			description:
				"Returns the source of the blocking script ModeWatcher injects, for inlining into an index.html or injecting from a server hook. Takes defaultMode, defaultTheme, darkClassNames, lightClassNames, themeColors, modeStorageKey, and themeStorageKey — pass the same values the manager has, or the page corrects itself after it loads.",
		},
	],
	toast: [
		{
			name: "createToastManager",
			description:
				"Creates the ToastManager that owns the toast list and the clocks. toasts is a signal holding the list frontmost-first; add, update, close, remove, promise, pause, and resume change it. Usually created at module scope so any code can push a message.",
			props: [
				{
					name: "timeout",
					type: "number",
					default: "5000",
					description: "Auto-dismiss delay in ms for toasts that don't set their own. 0 disables.",
				},
				{
					name: "limit",
					type: "number",
					default: "3",
					description:
						"How many toasts show at once. Extra toasts stay in the list with data-limited and their clocks held.",
				},
			],
		},
		{
			name: "ToastProvider",
			description:
				"Provides the manager and timing to every toast part inside it. Pauses every clock while the pointer is over the stack, while it holds focus, and while the window is blurred or the tab hidden. Makes its own manager when none is passed.",
			props: [
				{
					name: "manager",
					type: "ToastManager",
					description:
						"A manager from createToastManager(). Omitted, the provider creates a private one.",
				},
				{
					name: "timeout",
					type: "number",
					default: "5000",
					description: "Overrides the manager's default auto-dismiss delay.",
				},
				{
					name: "limit",
					type: "number",
					default: "3",
					description: "Overrides the manager's visible-toast limit.",
				},
				{
					name: "gap",
					type: "number",
					default: "16",
					description: "Pixels between expanded toasts, used when computing --toast-offset-y.",
				},
				{
					name: "hotkey",
					type: "string",
					default: '"F6"',
					description: "The key that moves focus into the viewport.",
				},
			],
		},
		{
			name: "ToastViewport",
			element: "Div",
			description:
				'The landmark region holding the stack. Sets role="region" with an aria-label naming the hotkey. Position it yourself; render the toasts inside it with ForEach over manager.toasts. Hover or focus expands the stack and pauses the clocks.',
			dataAttributes: [
				{ name: "data-toast-viewport", value: "Present" },
				{ name: "data-expanded", value: "Present while hovered or focused" },
			],
		},
		{
			name: "Toast",
			element: "Div",
			description:
				'One toast. Sets role="status" with aria-live from the toast\'s priority, handles swipe-to-dismiss and Escape, and removes itself after the exit transition (data-state="closed") finishes. Focusable.',
			props: [
				{
					name: "toast",
					type: "Readable<ToastData>",
					required: true,
					description: "The toast to render — the readable ForEach hands the render function.",
				},
				{
					name: "swipeDirection",
					type: "SwipeDirection | SwipeDirection[]",
					default: '["down", "right"]',
					description: "Which swipe direction(s) dismiss the toast.",
				},
			],
			dataAttributes: [
				{ name: "data-toast-root", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-type", value: "The toast's type, when set" },
				{ name: "data-expanded", value: "Present while the stack is expanded" },
				{ name: "data-behind", value: "Present when not the frontmost toast" },
				{ name: "data-limited", value: "Present when past the visible limit" },
				{ name: "data-swiping", value: "Present while a swipe is in flight" },
				{
					name: "data-swipe-direction",
					value: '"up" | "down" | "left" | "right" while swiping and through the exit',
				},
			],
			cssVariables: [
				{
					name: "--toast-index",
					description: "Position from the front; 0 is the frontmost toast.",
				},
				{
					name: "--toast-offset-y",
					description:
						"Distance in px to this toast's expanded slot, from measured heights plus the provider's gap.",
				},
				{ name: "--toast-height", description: "This toast's measured height in px." },
				{
					name: "--toast-frontmost-height",
					description:
						"The frontmost toast's measured height in px, for clamping a collapsed stack.",
				},
				{
					name: "--toast-swipe-movement-x",
					description: "Horizontal pointer travel in px during a swipe.",
				},
				{
					name: "--toast-swipe-movement-y",
					description: "Vertical pointer travel in px during a swipe.",
				},
			],
		},
		{
			name: "ToastTitle",
			element: "Div",
			description: "The toast's heading. The root points aria-labelledby at it.",
			dataAttributes: [
				{ name: "data-toast-title", value: "Present" },
				{ name: "data-type", value: "The toast's type, when set" },
			],
		},
		{
			name: "ToastDescription",
			element: "Div",
			description: "Supporting copy. The root points aria-describedby at it.",
			dataAttributes: [
				{ name: "data-toast-description", value: "Present" },
				{ name: "data-type", value: "The toast's type, when set" },
			],
		},
		{
			name: "ToastAction",
			element: "Button",
			description:
				"A button for the toast's action (undo, retry, …). Runs your onClick, then closes the toast.",
			dataAttributes: [
				{ name: "data-toast-action", value: "Present" },
				{ name: "data-type", value: "The toast's type, when set" },
			],
		},
		{
			name: "ToastClose",
			element: "Button",
			description: "Dismisses its toast. Labelled for assistive technology by default.",
			dataAttributes: [
				{ name: "data-toast-close", value: "Present" },
				{ name: "data-type", value: "The toast's type, when set" },
			],
		},
		{
			name: "ToastPortal",
			description:
				"Renders its children into another DOM parent so the stack escapes overflow and stacking contexts. This is the core Portal helper; context still resolves from where the portal is declared.",
			props: [
				{
					name: "to",
					type: "HTMLElement | Ref<HTMLElement>",
					default: "document.body",
					description: "The parent to teleport into.",
				},
				{
					name: "disabled",
					type: "Signal<boolean> | boolean",
					default: "false",
					description: "Mounts the children in place instead of teleporting.",
				},
			],
		},
	],
};
