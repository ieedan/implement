import rule from "../src/rules/role-has-required-aria-props.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("role-has-required-aria-props", rule, {
	valid: [
		'Div({ role: "checkbox", "aria-checked": checked });',
		'Div({ role: "heading", "aria-level": 2 });',
		'Div({ role: "slider", "aria-valuenow": value });',
		'Div({ role: "combobox", "aria-controls": id, "aria-expanded": open });',
		// Roles with nothing required.
		'Div({ role: "button" });',
		'Div({ role: "presentation" });',
		'Div({ role: "separator" });',
		'Div({ role: "progressbar" });',
		// A spread could be carrying the required property.
		'Div({ role: "checkbox", ...props });',
		// Not a role the table knows, so `valid-role` speaks instead.
		'Div({ role: "quuxquux" });',
		// Decided at runtime.
		"Div({ role: currentRole });",
		// A fallback list resolves to its first known role, which is satisfied.
		'Div({ role: "switch checkbox", "aria-checked": on });',
	],

	invalid: [
		{
			code: 'Div({ role: "checkbox" });',
			errors: [
				{
					messageId: "missing",
					data: { role: "checkbox", missing: "`aria-checked`", subject: "it" },
				},
			],
		},
		{
			code: 'Div({ role: "heading" }, "Title");',
			errors: [
				{ messageId: "missing", data: { role: "heading", missing: "`aria-level`", subject: "it" } },
			],
		},
		{
			code: 'Div({ role: "combobox", "aria-expanded": open });',
			errors: [
				{
					messageId: "missing",
					data: { role: "combobox", missing: "`aria-controls`", subject: "it" },
				},
			],
		},
		{
			// Both required properties are named in one report.
			code: 'Div({ role: "scrollbar" });',
			errors: [
				{
					messageId: "missing",
					data: {
						role: "scrollbar",
						missing: "`aria-controls` and `aria-valuenow`",
						subject: "them",
					},
				},
			],
		},
		{
			code: 'Div({ role: "option" });',
			errors: [
				{
					messageId: "missing",
					data: { role: "option", missing: "`aria-selected`", subject: "it" },
				},
			],
		},
	],
});
