import rule from "../src/rules/valid-role.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("valid-role", rule, {
	valid: [
		'Div({ role: "button" });',
		'Div({ role: "presentation" });',
		'Div({ role: "none" });',
		'Div({ role: "menuitemcheckbox" });',
		// A fallback list: the first role the browser understands wins.
		'Div({ role: "switch checkbox" });',
		// Runtime values are not the rule's business.
		"Div({ role: currentRole });",
		'Div({ role: derived([state], (s) => (s.busy ? "progressbar" : undefined)) });',
		"const { role } = props;",
		{
			code: 'Div({ role: "doc-chapter" });',
			options: [{ extraRoles: ["doc-chapter"] }],
		},
	],

	invalid: [
		{
			code: 'Div({ role: "buton" });',
			errors: [
				{
					messageId: "unknownSuggest",
					data: { role: "buton", suggestion: "button" },
					suggestions: [{ messageId: "replace", output: 'Div({ role: "button" });' }],
				},
			],
		},
		{
			// Only the token that is wrong gets rewritten.
			code: 'Div({ role: "menuitm menuitem" });',
			errors: [
				{
					messageId: "unknownSuggest",
					suggestions: [{ messageId: "replace", output: 'Div({ role: "menuitem menuitem" });' }],
				},
			],
		},
		{
			code: 'Div({ role: "widget" });',
			errors: [{ messageId: "abstract", data: { role: "widget" } }],
		},
		{
			code: 'Div({ role: "directory" });',
			errors: [{ messageId: "deprecated" }],
		},
		{
			code: 'Div({ role: "quuxquuxquux" });',
			errors: [{ messageId: "unknown", data: { role: "quuxquuxquux" } }],
		},
	],
});
