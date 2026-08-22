import rule from "../src/rules/prefer-effect.ts";
import { ruleTester } from "./rule-tester.ts";

const core = 'import { ImplementLifecycle, watch } from "@implementjs/core";\n';
/** What `core` becomes once the suggestion has added the import it needs. */
const withEffect =
	'import { ImplementLifecycle, watch, ImplementEffect } from "@implementjs/core";\n';
/** Already brings `ImplementEffect` in, so the suggestion only rewrites the call. */
const both = 'import { ImplementEffect, ImplementLifecycle, watch } from "@implementjs/core";\n';

ruleTester.run("prefer-effect", rule, {
	valid: [
		// Not a subscription at all.
		`${core}ImplementLifecycle({ onMount: (parent) => parent.querySelector("input").focus() });`,
		// `onChange` skips the first run; `ImplementEffect` does not. Swapping them would
		// change what the code does, so the rule leaves them alone.
		`${core}ImplementLifecycle({ onMount: () => query.onChange(refetch) });`,
		`${core}ImplementLifecycle({ onMount: () => query.subscribe(refetch) });`,
		// Children make it own a subtree, which ImplementEffect cannot do.
		`${core}ImplementLifecycle({ onMount: () => watch([a], f) }, IssueView());`,
		// There is more going on than the subscription.
		`${core}ImplementLifecycle({ onMount: () => watch([a], f), onUnmount: () => flush() });`,
		// The hook uses the element it is handed.
		`${core}ImplementLifecycle({ onMount: (parent) => watch([a], () => measure(parent)) });`,
		// More than one statement in the body.
		`${core}ImplementLifecycle({
			onMount: () => {
				announce();
				return watch([a], f);
			},
		});`,
		// A `watch` that is not the framework's.
		`import { ImplementLifecycle } from "@implementjs/core";
		import { watch } from "node:fs";
		ImplementLifecycle({ onMount: () => watch([a], f) });`,
	],

	invalid: [
		{
			code: `${core}ImplementLifecycle({ onMount: () => watch([theme], (t) => apply(t)) });`,
			errors: [
				{
					messageId: "preferEffect",
					suggestions: [
						{
							messageId: "replace",
							output: `${withEffect}ImplementEffect([theme], (t) => apply(t));`,
						},
					],
				},
			],
		},
		{
			code: `${core}ImplementLifecycle({
	onMount: () => {
		return watch([theme], apply);
	},
});`,
			errors: [
				{
					messageId: "preferEffect",
					suggestions: [
						{ messageId: "replace", output: `${withEffect}ImplementEffect([theme], apply);` },
					],
				},
			],
		},
		{
			// `ImplementEffect` is already imported, so the rewrite touches only the
			// call and does not add a second specifier for it.
			code: `${both}ImplementLifecycle({ onMount: () => watch([theme], apply) });`,
			errors: [
				{
					messageId: "preferEffect",
					suggestions: [
						{ messageId: "replace", output: `${both}ImplementEffect([theme], apply);` },
					],
				},
			],
		},
	],
});
