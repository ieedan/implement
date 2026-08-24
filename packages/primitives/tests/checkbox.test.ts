// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, signal, type Child } from "@implementjs/core";
import { Checkbox } from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(tree);
	await tick();
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

function element(target: ParentNode, selector: string): HTMLElement {
	const el = target.querySelector(selector);
	if (!(el instanceof HTMLElement)) throw new Error(`No ${selector}`);
	return el;
}

describe("checkbox", () => {
	it("is a button that toggles", async () => {
		const { target, unmount } = await mount(Checkbox());

		const box = element(target, "[data-checkbox-root]");
		expect(box.tagName).toBe("BUTTON");
		expect(box.getAttribute("role")).toBe("checkbox");
		expect(box.getAttribute("aria-checked")).toBe("false");
		expect(box.getAttribute("data-state")).toBe("unchecked");

		box.click();
		expect(box.getAttribute("aria-checked")).toBe("true");
		expect(box.getAttribute("data-state")).toBe("checked");

		unmount();
	});

	describe("decorative", () => {
		it("renders a span with nothing for assistive tech to read", async () => {
			const { target, unmount } = await mount(Checkbox({ decorative: true }));

			const box = element(target, "[data-checkbox-root]");
			expect(box.tagName).toBe("SPAN");
			expect(box.getAttribute("aria-hidden")).toBe("true");
			expect(box.hasAttribute("role")).toBe(false);
			expect(box.hasAttribute("type")).toBe(false);
			expect(box.hasAttribute("aria-checked")).toBe(false);
			expect(box.hasAttribute("tabindex")).toBe(false);

			unmount();
		});

		it("still tracks and toggles the checked state", async () => {
			const checked = signal(false);
			const { target, unmount } = await mount(Checkbox({ decorative: true, checked }));

			const box = element(target, "[data-checkbox-root]");
			expect(box.getAttribute("data-state")).toBe("unchecked");

			box.click();
			expect(checked.get()).toBe(true);
			expect(box.getAttribute("data-state")).toBe("checked");

			checked.set(false);
			expect(box.getAttribute("data-state")).toBe("unchecked");

			unmount();
		});

		it("leaves submitting to the control around it", async () => {
			const { target, unmount } = await mount(Checkbox({ decorative: true, name: "terms" }));

			expect(target.querySelector("input")).toBe(null);

			unmount();
		});

		it("writes through a two-way bind, the way a menu row's indicator does", async () => {
			const selected = signal(["ui-fix"]);
			const checked = selected.bind(
				(labels) => labels.includes("bug"),
				(labels, next) => (next ? [...labels, "bug"] : labels.filter((l) => l !== "bug")),
			);
			const { target, unmount } = await mount(Checkbox({ decorative: true, checked }));

			const box = element(target, "[data-checkbox-root]");
			expect(box.getAttribute("data-state")).toBe("unchecked");

			box.click();
			expect(selected.get()).toEqual(["ui-fix", "bug"]);
			expect(box.getAttribute("data-state")).toBe("checked");

			box.click();
			expect(selected.get()).toEqual(["ui-fix"]);
			expect(box.getAttribute("data-state")).toBe("unchecked");

			unmount();
		});
	});
});
