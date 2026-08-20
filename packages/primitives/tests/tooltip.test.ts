// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, signal } from "@implementjs/core";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/index";

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

function pointerEnter(el: Element) {
	el.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
}

function pointerLeave(el: Element, relatedTarget: Element | null = null) {
	el.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false, relatedTarget }));
}

describe("tooltip", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("opens after the delay on hover and closes on leave", async () => {
		const { target, unmount } = await mount(
			TooltipProvider(
				{},
				Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Add to library")),
			),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		const content = target.querySelector("[data-tooltip-content]")!;
		expect(trigger.getAttribute("data-state")).toBe("closed");
		expect(content.getAttribute("data-state")).toBe("closed");
		expect(content.getAttribute("role")).toBe("tooltip");

		pointerEnter(trigger);
		expect(trigger.getAttribute("data-state")).toBe("closed");

		vi.advanceTimersByTime(699);
		expect(trigger.getAttribute("data-state")).toBe("closed");
		vi.advanceTimersByTime(1);
		expect(trigger.getAttribute("data-state")).toBe("delayed-open");
		expect(content.getAttribute("data-state")).toBe("delayed-open");
		expect(trigger.getAttribute("aria-describedby")).toBe(content.id);

		pointerLeave(trigger, document.body);
		// hoverable content: the pointer wandering far outside every safe zone closes it
		document.dispatchEvent(new PointerEvent("pointermove", { clientX: 500, clientY: 500 }));
		expect(content.getAttribute("data-state")).toBe("closed");
		expect(trigger.getAttribute("aria-describedby")).toBeNull();

		unmount();
	});

	it("leaving before the delay never opens", async () => {
		const { target, unmount } = await mount(
			Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		pointerEnter(trigger);
		vi.advanceTimersByTime(300);
		pointerLeave(trigger, document.body);
		vi.advanceTimersByTime(1000);
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("opens instantly on keyboard focus and closes on blur", async () => {
		const { target, unmount } = await mount(
			Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		trigger.dispatchEvent(new FocusEvent("focus"));
		expect(trigger.getAttribute("data-state")).toBe("instant-open");

		trigger.dispatchEvent(new FocusEvent("blur"));
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("closes on trigger click, and stays open with disableCloseOnTriggerClick", async () => {
		const { target, unmount } = await mount(
			Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		pointerEnter(trigger);
		vi.advanceTimersByTime(700);
		expect(trigger.getAttribute("data-state")).toBe("delayed-open");

		trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();

		const second = await mount(
			Tooltip(
				{ disableCloseOnTriggerClick: true },
				TooltipTrigger({}, "Hover"),
				TooltipContent({}, "Tip"),
			),
		);
		const trigger2 = second.target.querySelector("[data-tooltip-trigger]")!;
		pointerEnter(trigger2);
		vi.advanceTimersByTime(700);
		trigger2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		trigger2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(trigger2.getAttribute("data-state")).toBe("delayed-open");

		second.unmount();
	});

	it("skips the delay when another tooltip in the provider just closed", async () => {
		const { target, unmount } = await mount(
			TooltipProvider(
				{},
				Tooltip({}, TooltipTrigger({ id: "t1" }, "One"), TooltipContent({}, "First")),
				Tooltip({}, TooltipTrigger({ id: "t2" }, "Two"), TooltipContent({}, "Second")),
			),
		);

		const [first, second] = [...target.querySelectorAll("[data-tooltip-trigger]")];

		pointerEnter(first!);
		vi.advanceTimersByTime(700);
		expect(first!.getAttribute("data-state")).toBe("delayed-open");

		// move to the second trigger within the skip-delay window
		pointerLeave(first!, second);
		pointerEnter(second!);
		expect(second!.getAttribute("data-state")).toBe("instant-open");
		expect(first!.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("waits through the full delay again after the skip window passes", async () => {
		const { target, unmount } = await mount(
			TooltipProvider(
				{},
				Tooltip({}, TooltipTrigger({ id: "t1" }, "One"), TooltipContent({}, "First")),
				Tooltip({}, TooltipTrigger({ id: "t2" }, "Two"), TooltipContent({}, "Second")),
			),
		);

		const [first, second] = [...target.querySelectorAll("[data-tooltip-trigger]")];

		pointerEnter(first!);
		vi.advanceTimersByTime(700);
		pointerLeave(first!, document.body);
		document.dispatchEvent(new PointerEvent("pointermove", { clientX: 500, clientY: 500 }));
		expect(first!.getAttribute("data-state")).toBe("closed");

		// past the 300ms skip window the delay applies again
		vi.advanceTimersByTime(400);
		pointerEnter(second!);
		expect(second!.getAttribute("data-state")).toBe("closed");
		vi.advanceTimersByTime(700);
		expect(second!.getAttribute("data-state")).toBe("delayed-open");

		unmount();
	});

	it("closes on Escape", async () => {
		const { target, unmount } = await mount(
			Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		pointerEnter(trigger);
		vi.advanceTimersByTime(700);
		expect(trigger.getAttribute("data-state")).toBe("delayed-open");

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("a disabled trigger never opens", async () => {
		const { target, unmount } = await mount(
			Tooltip({}, TooltipTrigger({ disabled: true }, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		expect(trigger.getAttribute("data-disabled")).toBe("");
		pointerEnter(trigger);
		vi.advanceTimersByTime(1000);
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("a provider-level disabled blocks every tooltip under it", async () => {
		const { target, unmount } = await mount(
			TooltipProvider(
				{ disabled: true },
				Tooltip({}, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
			),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		pointerEnter(trigger);
		vi.advanceTimersByTime(1000);
		expect(trigger.getAttribute("data-state")).toBe("closed");

		unmount();
	});

	it("a controlled open signal seeds and drives the open state", async () => {
		const open = signal(true);
		const { target, unmount } = await mount(
			Tooltip({ open }, TooltipTrigger({}, "Hover"), TooltipContent({}, "Tip")),
		);

		const trigger = target.querySelector("[data-tooltip-trigger]")!;
		const content = target.querySelector("[data-tooltip-content]")!;
		expect(content.getAttribute("data-state")).toBe("instant-open");
		expect(trigger.getAttribute("aria-describedby")).toBe(content.id);

		open.set(false);
		expect(content.getAttribute("data-state")).toBe("closed");

		unmount();
	});
});
