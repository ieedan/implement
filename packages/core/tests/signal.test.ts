import { describe, expect, it } from "vitest";
import { Signal, signal, type Writable } from "../src/signal";

describe("writable bind", () => {
	it("returns a Signal whose helpers write through a path", () => {
		const todo = signal({ done: false, tags: ["a"], count: 0 });
		const done = todo.bind("done");
		const tags = todo.bind("tags");
		const count = todo.bind("count");

		expect(done).toBeInstanceOf(Signal);
		done.toggle();
		expect(todo.get().done).toBe(true);

		expect(tags.push("b")).toBe(2);
		expect(todo.get().tags).toEqual(["a", "b"]);

		count.increment();
		expect(todo.get().count).toBe(1);
	});

	it("returns a Signal from selector + update bindings", () => {
		const todo = signal({ title: "hi", done: false });
		const done = todo.bind(
			(t) => t.done,
			(prev, next) => ({ ...prev, done: next }),
		);

		expect(done).toBeInstanceOf(Signal);
		done.toggle();
		expect(todo.get().done).toBe(true);
	});

	it("exposes Signal helpers through the Writable bind signature", () => {
		const source: Writable<{ done: boolean; items: string[] }> = signal({
			done: false,
			items: [],
		});
		source.bind("done").toggle();
		source.bind("items").push("x");
		expect(source.get()).toEqual({ done: true, items: ["x"] });
	});

	it("keeps one-way selector binds read-only", () => {
		const todo = signal({ done: false });
		const done = todo.bind((t) => t.done);
		expect(done).not.toBeInstanceOf(Signal);
		expect("set" in done).toBe(false);
	});
});

describe("signal()", () => {
	it("returns an existing writable unchanged", () => {
		const count = signal(0);
		expect(signal(count)).toBe(count);

		const open: Writable<boolean> = signal(false);
		expect(signal(open)).toBe(open);
	});

	it("wraps a plain value", () => {
		const count = signal(0);
		expect(count).toBeInstanceOf(Signal);
		expect(count.get()).toBe(0);
	});

	it("coerces a value-or-writable prop", () => {
		let open: boolean | Writable<boolean> = false;
		const fromValue = signal(open);
		expect(fromValue).toBeInstanceOf(Signal);
		expect(fromValue.get()).toBe(false);

		open = signal(true);
		expect(signal(open)).toBe(open);
	});
});
