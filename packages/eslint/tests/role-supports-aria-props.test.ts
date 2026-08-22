import rule from "../src/rules/role-supports-aria-props.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("role-supports-aria-props", rule, {
	valid: [
		'Div({ role: "checkbox", "aria-checked": on, "aria-required": true });',
		'Div({ role: "link", "aria-disabled": true, "aria-current": "page" });',
		'Div({ role: "tab", "aria-selected": true, "aria-controls": id });',
		'Div({ role: "menu", "aria-orientation": "vertical" });',
		// Global properties are supported by every role.
		'Div({ role: "presentation", "aria-hidden": true });',
		'Div({ role: "button", "aria-label": "Close", "aria-busy": false });',
		// No role written, so there is nothing to judge against.
		'Div({ "aria-checked": on });',
		// `valid-aria` owns unknown attributes; this rule has no opinion.
		'Div({ role: "button", "aria-lable": "Close" });',
		// A later spread could replace the role this was judged against.
		'Div({ role: "button", "aria-checked": on, ...props });',
		// Runtime role.
		'Div({ role: currentRole, "aria-checked": on });',
	],

	invalid: [
		{
			code: 'Div({ role: "button", "aria-checked": on });',
			errors: [{ messageId: "unsupported", data: { role: "button", attribute: "aria-checked" } }],
		},
		{
			code: 'Div({ role: "heading", "aria-selected": true });',
			errors: [{ messageId: "unsupported", data: { role: "heading", attribute: "aria-selected" } }],
		},
		{
			// Each unsupported property gets its own report.
			code: 'Div({ role: "link", "aria-checked": on, "aria-valuenow": 3 });',
			errors: [
				{ messageId: "unsupported", data: { role: "link", attribute: "aria-checked" } },
				{ messageId: "unsupported", data: { role: "link", attribute: "aria-valuenow" } },
			],
		},
		{
			// A spread before the role cannot change it, so the check still applies.
			code: 'Div({ ...props, role: "button", "aria-checked": on });',
			errors: [{ messageId: "unsupported", data: { role: "button", attribute: "aria-checked" } }],
		},
	],
});
