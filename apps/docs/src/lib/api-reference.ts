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
 * API reference tables, keyed by the `data-api` attribute a docs page uses to
 * place them: `<div data-api="avatar"></div>` in the markdown renders the
 * tables for every part of that primitive at that spot.
 */
export const apiReference: Record<string, ApiPart[]> = {
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
					name: "loop",
					type: "boolean",
					default: "true",
					description: "Whether arrow keys wrap from the last trigger back to the first.",
				},
			],
			dataAttributes: [{ name: "data-accordion-root", value: "Present" }],
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
			],
			dataAttributes: [
				{ name: "data-accordion-item", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
			],
		},
		{
			name: "AccordionTrigger",
			element: "Button",
			description: "Toggles its item open and closed.",
			dataAttributes: [
				{ name: "data-accordion-trigger", value: "Present" },
				{ name: "data-state", value: '"open" | "closed"' },
				{ name: "data-value", value: "The item's value" },
			],
		},
		{
			name: "AccordionContent",
			element: "Div",
			description: "The body of an item. Hidden with the `hidden` attribute while closed.",
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
			description: "The body. Hidden with the `hidden` attribute while closed.",
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
						"Mount in place instead of teleporting. Disable the inner portal on a nested dialog so it stays in the outer overlay. Also available as chained .Disabled(value).",
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
						"Mount in place instead of teleporting. Disable the inner portal on a nested dialog so it stays in the outer overlay. Also available as chained .Disabled(value).",
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
				"The selected label. Put it inside the trigger. Pass render to turn stored values into text.",
			props: [
				{
					name: "render",
					type: "(props: SelectValueRenderProps) => Child",
					description:
						'Called with the current selection. Discriminate on props.type: value is Signal<string | null> for "single", Signal<string[]> for "multiple". Omit it to show the raw value, or a comma-separated list.',
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
	],
};
