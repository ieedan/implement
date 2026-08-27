// @vitest-environment happy-dom
/* oxlint-disable typescript/no-non-null-assertion -- Queries for nodes the tree above just mounted. */
import { afterEach, describe, expect, it } from "vitest";
import { App, Div, If, Section, signal } from "@implementjs/core";
import {
	Dialog,
	DialogContent,
	Drawer,
	DrawerContent,
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

/** A left click, from the events the dismissable layer listens for. */
function click(el: HTMLElement) {
	el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
	el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** What the browser dispatches when the menu moves focus into its content. */
function focusInto(el: HTMLElement) {
	el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

function trigger(): HTMLElement {
	return document.querySelector<HTMLElement>("[data-dropdown-menu-trigger]")!;
}

function content(): HTMLElement {
	return document.querySelector<HTMLElement>("[data-dropdown-menu-content]")!;
}

function menu() {
	return DropdownMenu(
		DropdownMenuTrigger({}, "Open"),
		DropdownMenuContent(DropdownMenuItem({}, "One")),
	);
}

function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	App({ target }).render(tree);
	return target;
}

/**
 * A branch swap hands the same children to a different root, which unmounts
 * them and mounts them again. The menu registers its content with the root
 * state on every mount, and until the replacement instance was recognized as
 * a change, the root kept pointing at the discarded one — whose ref the
 * unmount had emptied. With no content element to compare against, everything
 * the layer saw counted as an interaction outside, so the menu opened on the
 * trigger's click and dismissed itself as the same click carried on.
 */
describe("a dropdown menu that is remounted", () => {
	// portaled content lands on the body, so a leftover tree would answer the
	// queries below before the one the next test mounts
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("still opens after its subtree moves to another root", async () => {
		const swapped = signal(false);
		const children = [menu()];
		mount(
			If(swapped)
				.Then(Section({}, ...children))
				.Else(Div({}, ...children)),
		);
		await tick();

		swapped.set(true);
		await tick();

		click(trigger());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");

		focusInto(content());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");
		expect(content().getAttribute("data-state")).toBe("open");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("still closes on an interaction outside it", async () => {
		const swapped = signal(false);
		const children = [menu()];
		const target = mount(
			If(swapped)
				.Then(Section({}, ...children))
				.Else(Div({}, ...children)),
		);
		await tick();

		swapped.set(true);
		await tick();

		click(trigger());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");

		click(target);
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("closed");
	});

	// The shape this came from: one set of children rendered into a Dialog or a
	// Drawer depending on a media query, which answers for the desktop through
	// hydration and corrects itself afterwards.
	it("still opens inside a modal root that was swapped under it", async () => {
		const mobile = signal(false);
		const open = signal(true);
		const children = [menu()];
		mount(
			If(mobile)
				.Then(Drawer({ open }, DrawerContent({}, ...children)))
				.Else(Dialog({ open }, DialogContent({}, ...children))),
		);
		await tick();

		mobile.set(true);
		await tick();

		click(trigger());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");

		focusInto(content());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");
	});
});

/**
 * A layer registers itself with the one above while it is open, so escape and
 * outside clicks reach the innermost one first. Unmounting an open layer has
 * to take that registration back, or the layer above keeps forwarding to a
 * layer that is gone and stops dismissing itself.
 */
describe("a dismissable layer unmounted while open", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("leaves the layer above it dismissable by escape", async () => {
		const open = signal(true);
		const showMenu = signal(true);
		mount(Dialog({ open }, DialogContent({}, If(showMenu).Then(menu()))));
		await tick();

		click(trigger());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");

		showMenu.set(false);
		await tick();

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await tick();
		expect(open.get()).toBe(false);
	});

	// The layer is rebuilt on every mount, and its registration follows the open
	// signal's transitions — of which a remount is not one. A subtree swapped
	// while its menu is open has to register the menu where it stands.
	it("registers a layer that is remounted already open", async () => {
		const dialogOpen = signal(true);
		const menuOpen = signal(true);
		const swapped = signal(false);
		const children = [
			DropdownMenu(
				{ open: menuOpen },
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(DropdownMenuItem({}, "One")),
			),
		];
		mount(
			Dialog(
				{ open: dialogOpen },
				DialogContent(
					{},
					If(swapped)
						.Then(Section({}, ...children))
						.Else(Div({}, ...children)),
				),
			),
		);
		await tick();

		swapped.set(true);
		await tick();

		// escape belongs to the innermost open layer, which is the menu
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await tick();
		expect(menuOpen.get()).toBe(false);
		expect(dialogOpen.get()).toBe(true);
	});

	it("leaves the layer above it dismissable by an outside click", async () => {
		const open = signal(true);
		const showMenu = signal(true);
		const target = mount(Dialog({ open }, DialogContent({}, If(showMenu).Then(menu()))));
		await tick();

		click(trigger());
		await tick();
		expect(trigger().getAttribute("data-state")).toBe("open");

		showMenu.set(false);
		await tick();

		click(target);
		await tick();
		expect(open.get()).toBe(false);
	});
});
