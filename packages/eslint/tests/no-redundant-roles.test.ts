import rule from "../src/rules/no-redundant-roles.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { Button, Div, Input, Nav, Ul } from "@implementjs/core";\n';

ruleTester.run("no-redundant-roles", rule, {
	valid: [
		// A role the element does not already have.
		`${core}Div({ role: "button" });`,
		`${core}Ul({ role: "tablist" });`,
		// `div` has no implicit role at all.
		`${core}Div({ role: "presentation" });`,
		// The role depends on `type`, and this is not the one `text` gets.
		`${core}Input({ type: "text", role: "checkbox" });`,
		// A spread could be supplying the role that wins.
		`${core}Button({ role: "button", ...props });`,
		// Not one of core's elements.
		'import { DialogTrigger } from "@implementjs/primitives";\nDialogTrigger({ role: "button" });',
		// A local `Button` of your own.
		'function Button(props) { return props; }\nButton({ role: "button" });',
		// Decided at runtime.
		`${core}Button({ role: currentRole });`,
	],

	invalid: [
		{
			code: `${core}Button({ role: "button" }, "Save");`,
			errors: [{ messageId: "redundant", data: { element: "<button>", role: "button" } }],
		},
		{
			code: `${core}Nav({ role: "navigation" });`,
			errors: [{ messageId: "redundant", data: { element: "<nav>", role: "navigation" } }],
		},
		{
			code: `${core}Ul({ role: "list" });`,
			errors: [{ messageId: "redundant", data: { element: "<ul>", role: "list" } }],
		},
		{
			// The role `input[type=checkbox]` already has.
			code: `${core}Input({ type: "checkbox", role: "checkbox" });`,
			errors: [{ messageId: "redundant", data: { element: "<input>", role: "checkbox" } }],
		},
		{
			// Aliasing on import does not hide which element it is.
			code: 'import { Button as ButtonElement } from "@implementjs/core";\nButtonElement({ role: "button" });',
			errors: [{ messageId: "redundant", data: { element: "<button>", role: "button" } }],
		},
	],
});
