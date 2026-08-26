import rule from "../src/rules/role-has-required-aria-props.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { Div, component } from "@implementjs/core";\n';

ruleTester.run("role-has-required-aria-props", rule, {
	valid: [
		`${core}Div({ role: "checkbox", "aria-checked": checked });`,
		`${core}Div({ role: "heading", "aria-level": 2 });`,
		`${core}Div({ role: "slider", "aria-valuenow": value });`,
		`${core}Div({ role: "combobox", "aria-controls": id, "aria-expanded": open });`,
		// Roles with nothing required.
		`${core}Div({ role: "button" });`,
		`${core}Div({ role: "presentation" });`,
		`${core}Div({ role: "separator" });`,
		`${core}Div({ role: "progressbar" });`,
		// A spread could be carrying the required property.
		`${core}Div({ role: "checkbox", ...props });`,
		// Not a role the table knows, so `valid-role` speaks instead.
		`${core}Div({ role: "quuxquux" });`,
		// Decided at runtime.
		`${core}Div({ role: currentRole });`,
		// A fallback list resolves to its first known role, which is satisfied.
		`${core}Div({ role: "switch checkbox", "aria-checked": on });`,
		// Away from an element, `role` is an ordinary word and this is a row on
		// its way into a database, not a checkbox missing its state.
		`${core}db.insert(workspaceMember).values({ id: nanoid(), role: "checkbox" });`,
		'const fixture = { role: "checkbox" };',
	],

	invalid: [
		{
			code: `${core}Div({ role: "checkbox" });`,
			errors: [
				{
					messageId: "missing",
					data: { role: "checkbox", missing: "`aria-checked`", subject: "it" },
				},
			],
		},
		{
			code: `${core}Div({ role: "heading" }, "Title");`,
			errors: [
				{ messageId: "missing", data: { role: "heading", missing: "`aria-level`", subject: "it" } },
			],
		},
		{
			code: `${core}Div({ role: "combobox", "aria-expanded": open });`,
			errors: [
				{
					messageId: "missing",
					data: { role: "combobox", missing: "`aria-controls`", subject: "it" },
				},
			],
		},
		{
			// Both required properties are named in one report.
			code: `${core}Div({ role: "scrollbar" });`,
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
			code: `${core}Div({ role: "option" });`,
			errors: [
				{
					messageId: "missing",
					data: { role: "option", missing: "`aria-selected`", subject: "it" },
				},
			],
		},
		{
			// `component()` names the tag first and its props after it.
			code: `${core}component("div", { role: "checkbox" });`,
			errors: [
				{
					messageId: "missing",
					data: { role: "checkbox", missing: "`aria-checked`", subject: "it" },
				},
			],
		},
	],
});
