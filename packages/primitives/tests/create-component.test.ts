// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, Div, type Child } from "@implementjs/core";
import { createComponent } from "../src/lib/create-component";

function mount(tree: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(tree);
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

describe("createComponent", () => {
	it("accepts props and children", () => {
		const Box = createComponent(function Box({ id }: { id?: string }, ...children: Child[]) {
			return Div({ id, "data-testid": "box" }, ...children);
		});

		const { target, unmount } = mount(Box({ id: "a" }, "hello"));
		expect(target.querySelector("#a")?.textContent).toBe("hello");
		unmount();
	});

	it("allows children without props", () => {
		const Box = createComponent(function Box(_props: { id?: string }, ...children: Child[]) {
			return Div({ "data-testid": "box" }, ...children);
		});

		const { target, unmount } = mount(Box("hello"));
		expect(target.querySelector("[data-testid=box]")?.textContent).toBe("hello");
		unmount();
	});

	it("allows multiple children without props", () => {
		const Box = createComponent(function Box(_props: Record<string, never>, ...children: Child[]) {
			return Div({}, ...children);
		});

		const { target, unmount } = mount(Box("one", "two"));
		expect(target.textContent).toBe("onetwo");
		unmount();
	});
});
