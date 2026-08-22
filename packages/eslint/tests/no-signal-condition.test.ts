import rule from "../src/rules/no-signal-condition.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { derived, signal } from "@implementjs/core";\n';

ruleTester.run("no-signal-condition", rule, {
	valid: [
		// Reading the value is what a condition wants.
		`${core}const open = signal(false);\nconst label = open.get() ? "Close" : "Open";`,
		// The reactive way round.
		`${core}const open = signal(false);\nconst label = open.bind((o) => (o ? "Close" : "Open"));`,
		`${core}const open = signal(false);\nIf(open).Then(Panel());`,
		// Plain values are none of the rule's business.
		"const flag = true;\nconst label = flag ? 'a' : 'b';",
		"function f(flag) { return flag ? 'a' : 'b'; }",
		// No evidence that this is a signal, so no report.
		'import { open } from "./state";\nconst label = open ? "a" : "b";',
		// `??` tests for nullishness, and a signal is never nullish — a different
		// mistake, and not one this rule claims.
		`${core}const open = signal(false);\nconst x = open ?? fallback;`,
	],

	invalid: [
		{
			code: `${core}const open = signal(false);\nconst label = open ? "Close" : "Open";`,
			errors: [{ messageId: "signalCondition", data: { name: "open" } }],
		},
		{
			code: `${core}const open = signal(false);\nconst hidden = !open;`,
			errors: [{ messageId: "signalCondition", data: { name: "open" } }],
		},
		{
			code: `${core}const open = signal(false);\nconst cls = open && "is-open";`,
			errors: [{ messageId: "signalCondition", data: { name: "open" } }],
		},
		{
			code: `${core}const open = signal(false);\nif (open) { announce(); }`,
			errors: [{ messageId: "signalCondition", data: { name: "open" } }],
		},
		{
			// A derived is a signal too.
			code: `${core}const isEmpty = derived([items], (i) => i.length === 0);\nconst cls = isEmpty ? "empty" : "";`,
			errors: [{ messageId: "signalCondition", data: { name: "isEmpty" } }],
		},
		{
			// `bind` yields a view onto a signal, so it is one as well.
			code: `${core}const todo = signal({ done: false });\nconst done = todo.bind("done");\nconst cls = done ? "x" : "";`,
			errors: [{ messageId: "signalCondition", data: { name: "done" } }],
		},
	],
});
