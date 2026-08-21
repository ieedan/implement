// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, signal } from "@implementjs/core";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
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

function element(target: ParentNode, selector: string, index = 0): HTMLElement {
	const el = target.querySelectorAll(selector)[index];
	if (!(el instanceof HTMLElement)) throw new Error(`No ${selector} at ${index}`);
	return el;
}

function item(value: string) {
	return AccordionItem(
		{ value },
		AccordionTrigger({}, value),
		AccordionContent({}, `${value} content`),
	);
}

describe("accordion", () => {
	it("opens and closes an item from its trigger", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a"), item("b")));

		const trigger = element(target, "[data-accordion-trigger]", 0);
		const content = element(target, "[data-accordion-content]", 0);

		expect(trigger.getAttribute("data-state")).toBe("closed");
		expect(content.hasAttribute("hidden")).toBe(true);

		trigger.click();
		expect(trigger.getAttribute("data-state")).toBe("open");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(content.hasAttribute("hidden")).toBe(false);

		trigger.click();
		expect(trigger.getAttribute("data-state")).toBe("closed");
		expect(content.hasAttribute("hidden")).toBe(true);

		unmount();
	});

	it("closes the others when type is single", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a"), item("b")));

		const a = element(target, "[data-accordion-trigger]", 0);
		const b = element(target, "[data-accordion-trigger]", 1);

		a.click();
		b.click();
		expect(a.getAttribute("data-state")).toBe("closed");
		expect(b.getAttribute("data-state")).toBe("open");

		unmount();
	});

	it("keeps items open when type is multiple", async () => {
		const { target, unmount } = await mount(Accordion({ type: "multiple" }, item("a"), item("b")));

		const a = element(target, "[data-accordion-trigger]", 0);
		const b = element(target, "[data-accordion-trigger]", 1);

		a.click();
		b.click();
		expect(a.getAttribute("data-state")).toBe("open");
		expect(b.getAttribute("data-state")).toBe("open");

		unmount();
	});

	it("is controlled by the value signal", async () => {
		const value = signal<string | null>("a");
		const { target, unmount } = await mount(Accordion({ value }, item("a"), item("b")));

		const a = element(target, "[data-accordion-content]", 0);
		const b = element(target, "[data-accordion-content]", 1);
		expect(a.hasAttribute("hidden")).toBe(false);
		expect(b.hasAttribute("hidden")).toBe(true);

		value.set("b");
		expect(a.hasAttribute("hidden")).toBe(true);
		expect(b.hasAttribute("hidden")).toBe(false);

		element(target, "[data-accordion-trigger]", 0).click();
		expect(value.get()).toBe("a");

		unmount();
	});

	it("ignores clicks on a disabled item", async () => {
		const { target, unmount } = await mount(
			Accordion(
				{},
				AccordionItem(
					{ value: "a", disabled: true },
					AccordionTrigger({}, "a"),
					AccordionContent({}, "a content"),
				),
			),
		);

		const trigger = element(target, "[data-accordion-trigger]");
		expect(trigger.hasAttribute("disabled")).toBe(true);
		expect(trigger.getAttribute("data-disabled")).toBe("");

		trigger.click();
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("wires the trigger and content together with aria attributes", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a")));

		const trigger = element(target, "[data-accordion-trigger]");
		const content = element(target, "[data-accordion-content]");

		expect(trigger.getAttribute("aria-controls")).toBe(content.id);
		expect(content.getAttribute("aria-labelledby")).toBe(trigger.id);
		expect(content.getAttribute("role")).toBe("region");

		unmount();
	});

	it("keeps closing content visible until its animations finish", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a")));

		const trigger = element(target, "[data-accordion-trigger]");
		const content = element(target, "[data-accordion-content]");

		trigger.click();
		expect(content.hasAttribute("hidden")).toBe(false);

		// Simulate a running close animation (happy-dom has no CSS engine).
		let finish!: () => void;
		const finished = new Promise<void>((resolve) => (finish = resolve));
		(content as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [{ finished }];

		trigger.click();
		expect(content.getAttribute("data-state")).toBe("closed");
		expect(content.hasAttribute("hidden")).toBe(false);

		finish();
		await tick();
		expect(content.hasAttribute("hidden")).toBe(true);

		unmount();
	});

	it("cancels a pending hide when the item reopens mid-animation", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a")));

		const trigger = element(target, "[data-accordion-trigger]");
		const content = element(target, "[data-accordion-content]");

		trigger.click();

		let finish!: () => void;
		const finished = new Promise<void>((resolve) => (finish = resolve));
		(content as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [{ finished }];

		trigger.click();
		trigger.click(); // reopen before the close animation finishes

		finish();
		await tick();
		expect(content.getAttribute("data-state")).toBe("open");
		expect(content.hasAttribute("hidden")).toBe(false);

		unmount();
	});

	it("measures the content size into CSS variables when opened", async () => {
		const { target, unmount } = await mount(Accordion({}, item("a")));

		const trigger = element(target, "[data-accordion-trigger]");
		const content = element(target, "[data-accordion-content]");

		content.getBoundingClientRect = () => ({ height: 120, width: 300 }) as DOMRect;

		trigger.click();
		expect(content.style.getPropertyValue("--ip-accordion-content-height")).toBe("120px");
		expect(content.style.getPropertyValue("--ip-accordion-content-width")).toBe("300px");

		unmount();
	});
});
