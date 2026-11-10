// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Await, derived, signal, type Readable } from "../src/index";

describe("Await over a readable", () => {
	it("calls a promise-producing getter once per source value", async () => {
		const id = signal(1);
		let calls = 0;
		const comments = derived([id], (n) => {
			calls++;
			return Promise.resolve(`comments for ${n}`);
		});

		const root = document.createElement("div");
		let latest: Readable<string> | null = null;
		const instance = Await(comments)
			.WhileLoading("loading")
			.Then((value) => {
				latest = value;
				return value.get();
			})();
		expect(calls).toBe(0);

		instance.mount(root);
		expect(calls).toBe(1);

		await Promise.resolve();
		await Promise.resolve();
		expect(root.textContent).toContain("comments for 1");

		id.set(2);
		expect(calls).toBe(2);
		await Promise.resolve();
		await Promise.resolve();
		expect(latest!.get()).toBe("comments for 2");
		instance.unmount();
	});
});
