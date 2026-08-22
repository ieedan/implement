import rule from "../src/rules/valid-aria.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("valid-aria", rule, {
	valid: [
		'Div({ "aria-label": "Close" });',
		'Div({ "aria-hidden": true });',
		'Div({ "aria-hidden": "false" });',
		'Div({ "aria-current": "page" });',
		'Div({ "aria-checked": "mixed" });',
		'Div({ "aria-valuenow": 40, "aria-valuemin": 0, "aria-valuemax": 100 });',
		'Div({ "aria-level": -1 });',
		'Div({ "aria-relevant": "additions text" });',
		'Div({ "aria-describedby": "hint-1 hint-2" });',
		// A readable is a legal prop value and what it yields is a runtime
		// question, so nothing here is knowable enough to report.
		'Div({ "aria-hidden": collapsed });',
		'Div({ "aria-current": derived([location], (l) => (l.path === href ? "page" : undefined)) });',
		// The key is what carries the attribute name; a Tailwind variant that
		// happens to spell one inside a class string does not.
		'Div({ class: "aria-invalid:border-destructive aria-lable:hidden" });',
		// Reading a prop rather than setting one.
		'const { "aria-label": label } = props;',
		// Computed keys are not knowable statically.
		"Div({ [name]: value });",
		{
			code: 'Div({ "aria-magic": "yes" });',
			options: [{ extraAttributes: ["aria-magic"] }],
		},
	],

	invalid: [
		{
			code: 'Div({ "aria-lable": "Close" });',
			errors: [
				{
					messageId: "unknownSuggest",
					data: { name: "aria-lable", suggestion: "aria-label" },
					suggestions: [
						{
							messageId: "replace",
							output: 'Div({ "aria-label": "Close" });',
						},
					],
				},
			],
		},
		{
			// Quote style is kept by the suggestion.
			code: "Div({ 'aria-lable': 'Close' });",
			errors: [
				{
					messageId: "unknownSuggest",
					suggestions: [{ messageId: "replace", output: "Div({ 'aria-label': 'Close' });" }],
				},
			],
		},
		{
			code: 'Div({ "aria-quuxquuxquux": 1 });',
			errors: [{ messageId: "unknown", data: { name: "aria-quuxquuxquux" } }],
		},
		{
			code: 'Div({ "aria-dropeffect": "copy" });',
			errors: [{ messageId: "deprecated" }],
		},
		{
			code: 'Div({ "aria-hidden": "yes" });',
			errors: [
				{
					messageId: "value",
					data: { name: "aria-hidden", actual: '"yes"', expected: "true or false" },
				},
			],
		},
		{
			code: 'Div({ "aria-current": "pge" });',
			errors: [{ messageId: "value" }],
		},
		{
			code: 'Div({ "aria-checked": "partial" });',
			errors: [
				{
					messageId: "value",
					data: { name: "aria-checked", actual: '"partial"', expected: "true, false, or mixed" },
				},
			],
		},
		{
			code: 'Div({ "aria-valuenow": "loud" });',
			errors: [
				{
					messageId: "value",
					data: { name: "aria-valuenow", actual: '"loud"', expected: "a number" },
				},
			],
		},
		{
			code: 'Div({ "aria-level": 1.5 });',
			errors: [
				{ messageId: "value", data: { name: "aria-level", actual: "1.5", expected: "an integer" } },
			],
		},
		{
			code: 'Div({ "aria-relevant": "additions sideways" });',
			errors: [{ messageId: "value" }],
		},
		{
			// Nested props objects are visited too.
			code: 'Dialog({ overlay: { "aria-lable": "x" } });',
			errors: [
				{
					messageId: "unknownSuggest",
					suggestions: [
						{ messageId: "replace", output: 'Dialog({ overlay: { "aria-label": "x" } });' },
					],
				},
			],
		},
	],
});
