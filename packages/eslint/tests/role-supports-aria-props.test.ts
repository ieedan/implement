import rule from "../src/rules/role-supports-aria-props.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { Div, component } from "@implementjs/core";\n';

ruleTester.run("role-supports-aria-props", rule, {
	valid: [
		`${core}Div({ role: "checkbox", "aria-checked": on, "aria-required": true });`,
		`${core}Div({ role: "link", "aria-disabled": true, "aria-current": "page" });`,
		`${core}Div({ role: "tab", "aria-selected": true, "aria-controls": id });`,
		`${core}Div({ role: "menu", "aria-orientation": "vertical" });`,
		// Global properties are supported by every role.
		`${core}Div({ role: "presentation", "aria-hidden": true });`,
		`${core}Div({ role: "button", "aria-label": "Close", "aria-busy": false });`,
		// No role written, so there is nothing to judge against.
		`${core}Div({ "aria-checked": on });`,
		// `valid-aria` owns unknown attributes; this rule has no opinion.
		`${core}Div({ role: "button", "aria-lable": "Close" });`,
		// A later spread could replace the role this was judged against.
		`${core}Div({ role: "button", "aria-checked": on, ...props });`,
		// Runtime role.
		`${core}Div({ role: currentRole, "aria-checked": on });`,
		// Away from an element there is no role to judge an attribute against —
		// this is a database column that happens to be spelled `role`.
		`${core}db.insert(workspaceMember).values({ role: "button", "aria-checked": on });`,
	],

	invalid: [
		{
			code: `${core}Div({ role: "button", "aria-checked": on });`,
			errors: [{ messageId: "unsupported", data: { role: "button", attribute: "aria-checked" } }],
		},
		{
			code: `${core}Div({ role: "heading", "aria-selected": true });`,
			errors: [{ messageId: "unsupported", data: { role: "heading", attribute: "aria-selected" } }],
		},
		{
			// Each unsupported property gets its own report.
			code: `${core}Div({ role: "link", "aria-checked": on, "aria-valuenow": 3 });`,
			errors: [
				{ messageId: "unsupported", data: { role: "link", attribute: "aria-checked" } },
				{ messageId: "unsupported", data: { role: "link", attribute: "aria-valuenow" } },
			],
		},
		{
			// A spread before the role cannot change it, so the check still applies.
			code: `${core}Div({ ...props, role: "button", "aria-checked": on });`,
			errors: [{ messageId: "unsupported", data: { role: "button", attribute: "aria-checked" } }],
		},
		{
			// `component()` names the tag first and its props after it.
			code: `${core}component("div", { role: "button", "aria-checked": on });`,
			errors: [{ messageId: "unsupported", data: { role: "button", attribute: "aria-checked" } }],
		},
	],
});
