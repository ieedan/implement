import rule from "../src/rules/valid-role.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { Div, component } from "@implementjs/core";\n';

ruleTester.run("valid-role", rule, {
	valid: [
		`${core}Div({ role: "button" });`,
		`${core}Div({ role: "presentation" });`,
		`${core}Div({ role: "none" });`,
		`${core}Div({ role: "menuitemcheckbox" });`,
		// A fallback list: the first role the browser understands wins.
		`${core}Div({ role: "switch checkbox" });`,
		// Runtime values are not the rule's business.
		`${core}Div({ role: currentRole });`,
		`${core}Div({ role: derived([state], (s) => (s.busy ? "progressbar" : undefined)) });`,
		"const { role } = props;",
		// `role` is an ordinary word away from an element: a database column,
		// an options bag, a test fixture. None of these render anything.
		`${core}db.insert(workspaceMember).values({ id: nanoid(), userId: user.id, role: "admin" });`,
		'const member = { id: "1", role: "owner" };',
		'export const defaults = { role: "viewer", theme: "dark" };',
		// A component of your own is not one of core's elements.
		'import { DialogTrigger } from "@implementjs/primitives";\nDialogTrigger({ role: "buton" });',
		// Props built up first and passed in later are out of reach.
		`${core}const props = { role: "buton" };\nDiv(props);`,
		// Only the props argument. An object in a child position is a value the
		// element renders, not attributes it sets.
		`${core}Div({}, { role: "buton" });`,
		{
			code: `${core}Div({ role: "doc-chapter" });`,
			options: [{ extraRoles: ["doc-chapter"] }],
		},
	],

	invalid: [
		{
			code: `${core}Div({ role: "buton" });`,
			errors: [
				{
					messageId: "unknownSuggest",
					data: { role: "buton", suggestion: "button" },
					suggestions: [{ messageId: "replace", output: `${core}Div({ role: "button" });` }],
				},
			],
		},
		{
			// Only the token that is wrong gets rewritten.
			code: `${core}Div({ role: "menuitm menuitem" });`,
			errors: [
				{
					messageId: "unknownSuggest",
					suggestions: [
						{ messageId: "replace", output: `${core}Div({ role: "menuitem menuitem" });` },
					],
				},
			],
		},
		{
			code: `${core}Div({ role: "widget" });`,
			errors: [{ messageId: "abstract", data: { role: "widget" } }],
		},
		{
			code: `${core}Div({ role: "directory" });`,
			errors: [{ messageId: "deprecated" }],
		},
		{
			code: `${core}Div({ role: "quuxquuxquux" });`,
			errors: [{ messageId: "unknown", data: { role: "quuxquuxquux" } }],
		},
		{
			// `component()` names the tag first and its props after it.
			code: `${core}component("div", { role: "widget" });`,
			errors: [{ messageId: "abstract", data: { role: "widget" } }],
		},
		{
			// Nested in an element's children, still element props.
			code: `${core}Div({}, Div({ role: "quuxquuxquux" }));`,
			errors: [{ messageId: "unknown", data: { role: "quuxquuxquux" } }],
		},
	],
});
