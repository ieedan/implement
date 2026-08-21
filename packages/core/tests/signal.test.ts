import { describe, expect, it } from "vitest";
import { Signal, signal, type Readable, type Writable } from "../src/signal";

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

describe("selector bind unwrapping", () => {
	it("unwraps a nested readable returned by the selector", () => {
		const behavior = signal<"close" | "ignore">("close");
		const content = signal<{ behavior: Readable<"close" | "ignore"> } | null>({ behavior });

		const bound: Readable<"close" | "ignore"> = content.bind((c) =>
			c === null ? "ignore" : c.behavior,
		);
		expect(bound.get()).toBe("close");
	});

	it("propagates changes from the inner readable to subscribers", () => {
		const behavior = signal<"close" | "ignore">("close");
		const content = signal<{ behavior: Readable<"close" | "ignore"> } | null>({ behavior });
		const bound = content.bind((c) => (c === null ? "ignore" : c.behavior));

		const seen: string[] = [];
		const unsubscribe = bound.subscribe((value) => seen.push(value));

		behavior.set("ignore");
		expect(seen).toEqual(["ignore"]);
		expect(bound.get()).toBe("ignore");

		content.set(null);
		expect(bound.get()).toBe("ignore");
		behavior.set("close");
		// detached from the old inner readable once the selector returned a plain value
		expect(bound.get()).toBe("ignore");

		unsubscribe();
	});

	it("re-follows a swapped inner readable", () => {
		const first = signal(1);
		const second = signal(10);
		const source = signal<{ inner: Signal<number> }>({ inner: first });
		const bound = source.bind((s) => s.inner);

		const seen: number[] = [];
		const unsubscribe = bound.subscribe((value) => seen.push(value));

		source.set({ inner: second });
		expect(seen).toEqual([10]);

		first.set(2); // stale inner must not leak through
		second.set(20);
		expect(seen).toEqual([10, 20]);

		unsubscribe();
	});

	it("keeps the inner subscription when the selector returns the same readable", () => {
		const inner = signal("a");
		const source = signal({ inner, other: 1 });
		const bound = source.bind((s) => s.inner);

		const seen: string[] = [];
		const unsubscribe = bound.subscribe((value) => seen.push(value));

		// A change elsewhere in the source re-runs the selector, which returns the
		// same readable. The inner subscription must survive that.
		source.set({ inner, other: 2 });
		inner.set("b");
		expect(seen).toEqual(["b"]);

		unsubscribe();
	});

	it("unwraps readables nested more than one level deep", () => {
		const innermost = signal("a");
		// signal() would return an existing writable as-is, so nest explicitly
		const middle = new Signal<Signal<string>>(innermost);
		const source = signal<{ value: Signal<Signal<string>> }>({ value: middle });
		const bound: Readable<string> = source.bind((s) => s.value);

		expect(bound.get()).toBe("a");

		const seen: string[] = [];
		const unsubscribe = bound.subscribe((value) => seen.push(value));
		innermost.set("b");
		expect(seen).toEqual(["b"]);

		unsubscribe();
	});

	it("leaves plain selector results untouched", () => {
		const count = signal(1);
		const doubled = count.bind((n) => n * 2);
		expect(doubled.get()).toBe(2);
		count.set(3);
		expect(doubled.get()).toBe(6);
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
