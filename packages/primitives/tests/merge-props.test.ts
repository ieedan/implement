import { describe, expect, it } from "vitest";
import { signal } from "@implementjs/core";
import { mergeProps } from "../src/lib/merge-props";

describe("mergeProps", () => {
	it("overrides non-special values with the later object", () => {
		const merged = mergeProps({ id: "a", type: "button" }, { id: "b" });
		expect(merged).toEqual({ id: "b", type: "button" });
	});

	it("does not let undefined override an earlier value", () => {
		const later: { id?: string } = { id: undefined };
		const merged = mergeProps({ id: "a" }, later);
		expect(merged.id).toBe("a");
	});

	it("skips null and undefined prop objects", () => {
		const merged = mergeProps({ id: "a" }, null, undefined, { class: "b" });
		expect(merged).toEqual({ id: "a", class: "b" });
	});

	it("composes event handlers and skips later ones after preventDefault", () => {
		const order: string[] = [];
		const merged = mergeProps(
			{
				onClick: (event: Event) => {
					order.push("internal");
					event.preventDefault();
				},
			},
			{
				onClick: (_event: Event) => {
					order.push("user");
				},
			},
		);

		const event = new Event("click", { cancelable: true });
		merged.onClick(event);

		expect(order).toEqual(["internal"]);
		expect(event.defaultPrevented).toBe(true);
	});

	it("runs later event handlers when the event is not prevented", () => {
		const order: string[] = [];
		const merged = mergeProps(
			{ onClick: (_event: Event) => order.push("internal") },
			{ onClick: (_event: Event) => order.push("user") },
		);

		merged.onClick(new Event("click"));
		expect(order).toEqual(["internal", "user"]);
	});

	it("resolves Bindable event handlers at call time", () => {
		const order: string[] = [];
		const userClick = signal<(event: Event) => void>((_event) => {
			order.push("first");
		});
		const merged = mergeProps(
			{ onClick: (_event: Event) => order.push("internal") },
			{ onClick: userClick },
		);

		merged.onClick(new Event("click"));
		expect(order).toEqual(["internal", "first"]);

		userClick.set(() => {
			order.push("second");
		});
		merged.onClick(new Event("click"));
		expect(order).toEqual(["internal", "first", "internal", "second"]);
	});

	it("chains non-event functions so they all run", () => {
		const order: number[] = [];
		const merged = mergeProps(
			{ format: (n: number) => order.push(n) },
			{ format: (n: number) => order.push(n + 10) },
		);

		merged.format(1);
		expect(order).toEqual([1, 11]);
	});

	it("merges class values into a nested ClassValue array", () => {
		const merged = mergeProps({ class: "a" }, { class: { active: true } }, { class: ["b"] });
		expect(merged.class).toEqual([["a", { active: true }], ["b"]]);
	});

	it("folds className into class", () => {
		const merged = mergeProps({ class: "a" }, { className: "b" });
		expect(merged).toEqual({ class: ["a", "b"] });
		expect("className" in merged).toBe(false);
	});

	it("merges style objects without stringifying them", () => {
		const color = signal("red");
		const merged = mergeProps(
			{ style: { display: "none", color } },
			{ style: { display: "block", opacity: "1" } },
		);

		expect(merged.style).toEqual({ display: "block", color, opacity: "1" });
	});

	it("parses CSS strings into objects so they merge with style objects", () => {
		const merged = mergeProps(
			{ style: "color: red; background-color: blue" },
			{ style: { display: "flex" } },
		);

		expect(merged.style).toEqual({
			color: "red",
			backgroundColor: "blue",
			display: "flex",
		});
	});

	it("keeps custom properties when parsing CSS strings", () => {
		const merged = mergeProps({ style: "--size: 1rem; color: red" }, { style: { color: "blue" } });
		expect(merged.style).toEqual({ "--size": "1rem", color: "blue" });
	});
});
