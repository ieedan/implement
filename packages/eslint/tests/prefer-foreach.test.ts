import rule from "../src/rules/prefer-foreach.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("prefer-foreach", rule, {
	valid: [
		// The reactive way round.
		"Ul(ForEach(items, (item) => item.id, (item) => Li(item)));",
		// Not a rendered position: an event handler wants the value it has now.
		"Button({ onClick: () => save(items.get().map(toDto)) }, 'Save');",
		"const payload = items.get().map(toDto);",
		"function toRows() { return items.get().map(toDto); }",
		// `Map.prototype.get` takes a key, so it is never the snapshot read.
		"Ul(...byId.get(key).map((item) => Li(item)));",
		// Mapping the unwrapped value inside an effect is correct.
		"ImplementEffect([items], (list) => Ul(...list.map((item) => Li(item))));",
		// A lowercase callee is not a component.
		"render(items.get().map(toRow));",
	],

	invalid: [
		{
			code: "Ul(...items.get().map((item) => Li(item)));",
			errors: [{ messageId: "preferForEach", data: { source: "items" } }],
		},
		{
			// Passed as a single children argument rather than spread.
			code: "Ul(items.get().map((item) => Li(item)));",
			errors: [{ messageId: "preferForEach", data: { source: "items" } }],
		},
		{
			// A member-expression source is named in full.
			code: "Div(...state.rows.get().map(Row));",
			errors: [{ messageId: "preferForEach", data: { source: "state.rows" } }],
		},
		{
			// A component reached through a namespace still counts.
			code: "Ui.List(...items.get().map(Row));",
			errors: [{ messageId: "preferForEach", data: { source: "items" } }],
		},
	],
});
