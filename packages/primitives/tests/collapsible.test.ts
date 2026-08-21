// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it } from "vitest";
import { App, signal, type ComponentProps } from "@implementjs/core";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../src/index";

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

function element(target: ParentNode, selector: string): HTMLElement {
	const el = target.querySelector(selector);
	if (!(el instanceof HTMLElement)) throw new Error(`No ${selector}`);
	return el;
}

function tree(open?: ComponentProps<typeof Collapsible>["open"]) {
	return Collapsible(
		{ open },
		CollapsibleTrigger({}, "Toggle"),
		CollapsibleContent({}, "The content"),
	);
}

describe("collapsible", () => {
	it("opens and closes from its trigger", async () => {
		const { target, unmount } = await mount(tree());

		const trigger = element(target, "[data-collapsible-trigger]");
		const content = element(target, "[data-collapsible-content]");

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

	it("is controlled by the open signal", async () => {
		const open = signal(true);
		const { target, unmount } = await mount(tree(open));

		const content = element(target, "[data-collapsible-content]");
		expect(content.hasAttribute("hidden")).toBe(false);

		open.set(false);
		expect(content.hasAttribute("hidden")).toBe(true);

		element(target, "[data-collapsible-trigger]").click();
		expect(open.get()).toBe(true);

		unmount();
	});

	it("points the trigger at the content with aria-controls", async () => {
		const { target, unmount } = await mount(tree());

		const trigger = element(target, "[data-collapsible-trigger]");
		const content = element(target, "[data-collapsible-content]");
		expect(trigger.getAttribute("aria-controls")).toBe(content.id);

		unmount();
	});

	it("keeps closing content visible until its animations finish", async () => {
		const { target, unmount } = await mount(tree());

		const trigger = element(target, "[data-collapsible-trigger]");
		const content = element(target, "[data-collapsible-content]");

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

	it("cancels a pending hide when reopened mid-animation", async () => {
		const { target, unmount } = await mount(tree());

		const trigger = element(target, "[data-collapsible-trigger]");
		const content = element(target, "[data-collapsible-content]");

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
		const { target, unmount } = await mount(tree());

		const trigger = element(target, "[data-collapsible-trigger]");
		const content = element(target, "[data-collapsible-content]");

		content.getBoundingClientRect = () => ({ height: 80, width: 240 }) as DOMRect;

		trigger.click();
		expect(content.style.getPropertyValue("--ip-collapsible-content-height")).toBe("80px");
		expect(content.style.getPropertyValue("--ip-collapsible-content-width")).toBe("240px");

		unmount();
	});

	it("uses hidden=until-found when hiddenUntilFound is set", async () => {
		const { target, unmount } = await mount(
			Collapsible(
				{},
				CollapsibleTrigger({}, "Toggle"),
				CollapsibleContent({ hiddenUntilFound: true }, "The content"),
			),
		);

		const content = element(target, "[data-collapsible-content]");
		expect(content.getAttribute("hidden")).toBe("until-found");

		unmount();
	});
});
