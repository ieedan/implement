import rule from "../src/rules/no-hanging-unsubscribe.ts";
import { ruleTester } from "./rule-tester.ts";

const core =
	'import { ImplementEffect, ImplementLifecycle, signal, watch } from "@implementjs/core";\n';
const external = 'import { mode } from "./mode";\n';

ruleTester.run("no-hanging-unsubscribe", rule, {
	valid: [
		// Module scope: the subscription is meant to last as long as the app.
		`${external}mode.current.subscribe((value) => console.log(value));`,
		// Kept, so it can be called.
		`${external}function C() { const stop = mode.current.subscribe(f); return stop; }`,
		// Handed to Lifecycle, which calls it on unmount.
		`${core}${external}function C() {
			return ImplementLifecycle({ onMount: () => mode.current.subscribe(f) });
		}`,
		`${core}${external}function C() {
			return ImplementLifecycle({
				onMount: () => {
					const stop = mode.current.subscribe(f);
					return stop;
				},
			});
		}`,
		// The signal is created here, so it and the subscription are collected
		// together when the component goes.
		`${core}function C() {
			const preference = signal(null);
			preference.onChange((value) => set(value));
			return Div();
		}`,
		// Declared in the component and subscribed from a callback inside it:
		// still one lifetime.
		`${core}function C() {
			const preference = signal(null);
			ImplementLifecycle({ onMount: () => { preference.onChange(f); } });
		}`,
		// Every source is local.
		`${core}function C() {
			const a = signal(1);
			watch([a], (value) => console.log(value));
		}`,
		// Not a call the rule knows how to weigh up.
		`${core}function C() { watch(sources, f); }`,
		// Whoever calls `MenuRoot` may well have created `state` a line earlier,
		// so a parameter is left alone unless the project opts in.
		"function MenuRoot(state) { state.open.subscribe(f); }",
		// `watch` here is not the framework's.
		`import { watch } from "node:fs";
		import { theme } from "./theme";
		function C() { watch([theme], f); }`,
	],

	invalid: [
		{
			code: `${external}function C() { mode.current.subscribe(f); }`,
			errors: [{ messageId: "method", data: { name: "mode.current" } }],
		},
		{
			code: `${external}function C() { mode.current.onChange(f); }`,
			errors: [{ messageId: "method", data: { name: "mode.current" } }],
		},
		{
			code: "function IssueView(id) { id.onChange(refetch); }",
			options: [{ checkParameters: true }],
			errors: [{ messageId: "method", data: { name: "id" } }],
		},
		{
			// Owned by Lifecycle, but the cleanup is never returned from it.
			code: `${core}${external}function C() {
				ImplementLifecycle({
					onMount: () => {
						mode.current.subscribe(f);
					},
				});
			}`,
			errors: [{ messageId: "method", data: { name: "mode.current" } }],
		},
		{
			code: `${core}import { theme } from "./theme";
			function C() { watch([theme], (t) => apply(t)); }`,
			errors: [{ messageId: "helper", data: { callee: "watch", name: "theme" } }],
		},
		{
			// One local source does not rescue the imported one beside it.
			code: `${core}import { theme } from "./theme";
			function C() {
				const a = signal(1);
				watch([a, theme], f);
			}`,
			errors: [{ messageId: "helper", data: { callee: "watch", name: "theme" } }],
		},
	],
});
