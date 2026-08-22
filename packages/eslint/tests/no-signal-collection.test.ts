import rule from "../src/rules/no-signal-collection.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { signal } from "@implementjs/core";\n';
/** What `core` becomes once a suggestion has added the import it needs. */
const withSet = 'import { signal, ImplementSet } from "@implementjs/core";\n';
const withMap = 'import { signal, ImplementMap } from "@implementjs/core";\n';

ruleTester.run("no-signal-collection", rule, {
	valid: [
		// The reactive collections themselves.
		'import { ImplementSet } from "@implementjs/core";\nconst selected = ImplementSet();',
		'import { ImplementMap } from "@implementjs/core";\nconst drafts = ImplementMap();',
		// Signals of things that are not collections.
		`${core}const count = signal(0);`,
		`${core}const todos = signal([]);`,
		`${core}const user = signal({ name: "Ada" });`,
		// The readonly opt-out needs TS generics, so it lives in `oxlint.test.ts`.
		// A `signal` that is not core's.
		'import { signal } from "some-other-lib";\nconst s = signal(new Set());',
	],

	invalid: [
		{
			code: `${core}const selected = signal(new Set());`,
			errors: [
				{
					messageId: "preferReactive",
					data: { collection: "Set", replacement: "ImplementSet" },
					suggestions: [
						{
							messageId: "replace",
							data: { replacement: "ImplementSet" },
							output: `${withSet}const selected = ImplementSet();`,
						},
					],
				},
			],
		},
		{
			// Constructor arguments are carried across.
			code: `${core}const selected = signal(new Set(["a", "b"]));`,
			errors: [
				{
					messageId: "preferReactive",
					suggestions: [
						{
							messageId: "replace",
							output: `${withSet}const selected = ImplementSet(["a", "b"]);`,
						},
					],
				},
			],
		},
		{
			code: `${core}const drafts = signal(new Map());`,
			errors: [
				{
					messageId: "preferReactive",
					data: { collection: "Map", replacement: "ImplementMap" },
					suggestions: [
						{ messageId: "replace", output: `${withMap}const drafts = ImplementMap();` },
					],
				},
			],
		},
		{
			// Already imported, so the rewrite only touches the call.
			code: `${withSet}const selected = signal(new Set());`,
			errors: [
				{
					messageId: "preferReactive",
					suggestions: [
						{ messageId: "replace", output: `${withSet}const selected = ImplementSet();` },
					],
				},
			],
		},
		{
			// Not a declarator, so there is nothing to rewrite around.
			code: `${core}register(signal(new Set()));`,
			errors: [
				{
					messageId: "preferReactive",
					suggestions: [{ messageId: "replace", output: `${withSet}register(ImplementSet());` }],
				},
			],
		},
	],
});
