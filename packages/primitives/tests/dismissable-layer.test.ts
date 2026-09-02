// @vitest-environment happy-dom
/* oxlint-disable typescript/no-non-null-assertion -- Queries for nodes the tree above just mounted. */
import { afterEach, describe, expect, it } from "vitest";
import { App, Button, Div, signal } from "@implementjs/core";
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

/** The press half of an interaction, from the events the layer listens for. */
function press(el: HTMLElement, pointerType: string) {
	el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType }));
}

/** The release half. The browser sends it to whatever covers the point on release. */
function release(el: HTMLElement) {
	el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** A gesture the browser took over — a scroll, a drag off the target. */
function cancel(el: HTMLElement) {
	el.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
}

function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	App({ target }).render(tree);
	return target;
}

function query(selector: string): HTMLElement {
	return document.querySelector<HTMLElement>(selector)!;
}

/**
 * A tap outside a modal used to dismiss it on `pointerdown`, while the finger
 * was still down. The click the browser dispatches on release then landed on
 * whatever was under the tap — on a phone, straight onto the element the scrim
 * had been covering. The scrim cannot defend that gap either: a browser stops
 * hit-testing an element whose `display` is transitioning to `none` from the
 * first frame of the transition. So the dismissal waits for the click, and the
 * two become one event.
 */
describe("a touch outside a dismissable layer", () => {
	afterEach(() => {
		document.body.replaceChildren();
		document.body.removeAttribute("style");
	});

	it("leaves the layer up until the click that follows the press", async () => {
		const open = signal(true);
		const target = mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		press(target, "touch");
		await tick();
		// still covering the page, so the click on release lands on the layer
		expect(open.get()).toBe(true);

		release(target);
		await tick();
		expect(open.get()).toBe(false);
	});

	it("dismisses a pen press on its click too", async () => {
		const open = signal(true);
		const target = mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		press(target, "pen");
		await tick();
		expect(open.get()).toBe(true);

		release(target);
		await tick();
		expect(open.get()).toBe(false);
	});

	it("does not click through to the element the layer was covering", async () => {
		const open = signal(true);
		let clicked = 0;
		mount(
			Div(
				{},
				Button({ id: "behind", onClick: () => clicked++ }, "Behind"),
				Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")),
			),
		);
		await tick();

		const overlay = query("[data-dialog-overlay]");
		press(overlay, "touch");
		await tick();
		// the dialog is still open, so the release goes to the overlay and not to
		// the button underneath it
		expect(open.get()).toBe(true);

		release(overlay);
		await tick();
		expect(open.get()).toBe(false);
		expect(clicked).toBe(0);
	});

	it("still dismisses a mouse press on the press itself", async () => {
		const open = signal(true);
		const target = mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		press(target, "mouse");
		await tick();
		expect(open.get()).toBe(false);
	});

	it("leaves a press inside the layer alone", async () => {
		const open = signal(true);
		mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		const content = query("[data-dialog-content]");
		press(content, "touch");
		release(content);
		await tick();
		expect(open.get()).toBe(true);
	});

	it("drops a press the browser took over, and the click that comes later", async () => {
		const open = signal(true);
		const target = mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		// a scroll rather than a tap: no click follows this one
		press(target, "touch");
		cancel(target);
		await tick();
		expect(open.get()).toBe(true);

		// and the pending dismissal is gone, so an unrelated click does not spend it
		release(target);
		await tick();
		expect(open.get()).toBe(true);
	});

	it("keeps only the newest press waiting on a click", async () => {
		const open = signal(true);
		const target = mount(Dialog({ open }, DialogOverlay({}), DialogContent({}, "Content")));
		await tick();

		press(target, "touch");
		press(target, "touch");
		await tick();
		expect(open.get()).toBe(true);

		release(target);
		await tick();
		expect(open.get()).toBe(false);

		// the superseded press left nothing behind to fire a second time
		const reopened = signal(true);
		document.body.replaceChildren();
		mount(Dialog({ open: reopened }, DialogContent({}, "Content")));
		await tick();
		expect(reopened.get()).toBe(true);
	});

	// the innermost layer answers for the interaction, whether it is dismissed
	// on the press or on the click that follows it
	it("dismisses only the innermost layer", async () => {
		const dialogOpen = signal(true);
		mount(
			Dialog(
				{ open: dialogOpen },
				DialogOverlay({}),
				DialogContent(
					{},
					DropdownMenu(
						DropdownMenuTrigger({}, "Open"),
						DropdownMenuContent(DropdownMenuItem({}, "One")),
					),
				),
			),
		);
		await tick();

		const trigger = query("[data-dropdown-menu-trigger]");
		press(trigger, "touch");
		release(trigger);
		await tick();
		expect(trigger.getAttribute("data-state")).toBe("open");

		const content = query("[data-dialog-content]");
		press(content, "touch");
		await tick();
		expect(trigger.getAttribute("data-state")).toBe("open");

		release(content);
		await tick();
		expect(trigger.getAttribute("data-state")).toBe("closed");
		expect(dialogOpen.get()).toBe(true);
	});
});
