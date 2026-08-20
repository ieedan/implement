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
			],
			dataAttributes: [
				{ name: "data-checkbox-root", value: "Present" },
				{ name: "data-state", value: '"checked" | "unchecked" | "indeterminate"' },
			],
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
				'The list. Sets role="listbox". Style visibility yourself; the primitive does not hide it for you.',
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
