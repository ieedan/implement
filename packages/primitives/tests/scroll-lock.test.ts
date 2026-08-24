// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { afterEach, describe, expect, it } from "vitest";
import { App, signal } from "@implementjs/core";
import {
	Dialog,
	DialogContent,
	DialogTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "../src/index";
import { lockBodyScroll } from "../src/lib/components/helpers/scroll-lock";

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

describe("lockBodyScroll", () => {
	afterEach(() => {
		document.body.removeAttribute("style");
	});

	it("sets overflow hidden and restores the previous inline style", () => {
		document.body.setAttribute("style", "color: red");
		const unlock = lockBodyScroll();
		expect(document.body.style.overflow).toBe("hidden");
		expect(document.body.style.color).toBe("red");
		unlock();
		expect(document.body.getAttribute("style")).toBe("color: red");
	});

	it("keeps the lock until the last nested caller unlocks", () => {
		const first = lockBodyScroll();
		const second = lockBodyScroll();
		expect(document.body.style.overflow).toBe("hidden");
		first();
		expect(document.body.style.overflow).toBe("hidden");
		second();
		expect(document.body.style.overflow).toBe("");
	});

	it("is a no-op if unlock is called twice", () => {
		const unlock = lockBodyScroll();
		unlock();
		unlock();
		expect(document.body.getAttribute("style")).toBeNull();
	});

	it("pads the body by the scrollbar width so layout does not shift", () => {
		const innerWidth = window.innerWidth;
		const clientWidth = document.documentElement.clientWidth;
		Object.defineProperty(window, "innerWidth", { configurable: true, value: clientWidth + 16 });

		const unlock = lockBodyScroll();
		expect(document.body.style.paddingRight).toBe("16px");
		expect(document.body.style.getPropertyValue("--ip-scrollbar-width")).toBe("16px");
		unlock();

		Object.defineProperty(window, "innerWidth", { configurable: true, value: innerWidth });
	});
});

describe("dialog scroll lock", () => {
	afterEach(() => {
		document.body.removeAttribute("style");
	});

	it("locks while open and restores on close", async () => {
		const open = signal(false);
		const { target, unmount } = await mount(
			Dialog({ open }, DialogTrigger({}, "Open"), DialogContent({}, "Hello")),
		);

		expect(document.body.style.overflow).not.toBe("hidden");

		(target.querySelector("[data-dialog-trigger]") as HTMLButtonElement).click();
		expect(document.body.style.overflow).toBe("hidden");

		open.set(false);
		expect(document.body.style.overflow).toBe("");

		unmount();
	});

	it("locks when it starts open and restores on unmount", async () => {
		const { unmount } = await mount(
			Dialog({ open: true }, DialogTrigger({}, "Open"), DialogContent({}, "Hello")),
		);

		expect(document.body.style.overflow).toBe("hidden");
		unmount();
		expect(document.body.style.overflow).toBe("");
	});

	it("does not lock when preventScroll is false", async () => {
		const { unmount } = await mount(
			Dialog(
				{ open: true, preventScroll: false },
				DialogTrigger({}, "Open"),
				DialogContent({}, "Hello"),
			),
		);

		expect(document.body.style.overflow).not.toBe("hidden");
		unmount();
	});

	it("keeps the page locked while a nested dialog is still open", async () => {
		const outer = signal(true);
		const inner = signal(true);
		const { unmount } = await mount(
			Dialog(
				{ open: outer },
				DialogTrigger({}, "Outer"),
				DialogContent(
					{},
					"Outer",
					Dialog({ open: inner }, DialogTrigger({}, "Inner"), DialogContent({}, "Inner")),
				),
			),
		);

		expect(document.body.style.overflow).toBe("hidden");
		inner.set(false);
		expect(document.body.style.overflow).toBe("hidden");
		outer.set(false);
		expect(document.body.style.overflow).toBe("");

		unmount();
	});
});

describe("overlay scroll lock defaults", () => {
	afterEach(() => {
		document.body.removeAttribute("style");
	});

	it("does not lock a popover unless preventScroll is true", async () => {
		const { unmount } = await mount(
			Popover({ open: true }, PopoverTrigger({}, "Open"), PopoverContent({}, "Hello")),
		);
		expect(document.body.style.overflow).not.toBe("hidden");
		unmount();

		const locked = await mount(
			Popover(
				{ open: true, preventScroll: true },
				PopoverTrigger({}, "Open"),
				PopoverContent({}, "Hello"),
			),
		);
		expect(document.body.style.overflow).toBe("hidden");
		locked.unmount();
	});

	it("does not lock a select unless preventScroll is true", async () => {
		const { unmount } = await mount(
			Select(
				{ open: signal(true) },
				SelectTrigger({}, "Open"),
				SelectContent({}, SelectItem({ value: "a" }, "A")),
			),
		);
		expect(document.body.style.overflow).not.toBe("hidden");
		unmount();

		const locked = await mount(
			Select(
				{ open: signal(true), preventScroll: true },
				SelectTrigger({}, "Open"),
				SelectContent({}, SelectItem({ value: "a" }, "A")),
			),
		);
		expect(document.body.style.overflow).toBe("hidden");
		locked.unmount();
	});

	it("locks a dropdown menu by default", async () => {
		const { unmount } = await mount(
			DropdownMenu(
				{ open: true },
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent({}, DropdownMenuItem({}, "Item")),
			),
		);
		expect(document.body.style.overflow).toBe("hidden");
		unmount();
		expect(document.body.style.overflow).toBe("");
	});
});

/** A touch at `y`, as the browser delivers it to a non-passive listener. */
function touch(type: string, target: EventTarget, x: number, y: number): boolean {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { touches: [{ clientX: x, clientY: y }] });
	target.dispatchEvent(event);
	return event.defaultPrevented;
}

/** A real scroll container: overflow that scrolls, and content taller than the box. */
function scroller(scrollHeight: number, clientHeight: number, scrollTop: number): HTMLElement {
	const el = document.createElement("div");
	el.style.overflowY = "auto";
	Object.defineProperties(el, {
		scrollHeight: { value: scrollHeight, configurable: true },
		clientHeight: { value: clientHeight, configurable: true },
	});
	el.scrollTop = scrollTop;
	document.body.appendChild(el);
	return el;
}

/**
 * `overflow: hidden` on the body is not enough on iOS Safari, so a lock also
 * cancels touch moves that nothing under the finger can absorb. Everything the
 * page behind is made of is one of those.
 */
describe("holding the page still under a finger", () => {
	afterEach(() => {
		document.body.replaceChildren();
		document.body.removeAttribute("style");
	});

	it("cancels a drag over the page behind, and leaves it alone unlocked", () => {
		const page = document.createElement("p");
		document.body.appendChild(page);

		touch("touchstart", page, 20, 400);
		expect(touch("touchmove", page, 20, 300)).toBe(false);

		const unlock = lockBodyScroll();
		touch("touchstart", page, 20, 400);
		expect(touch("touchmove", page, 20, 300)).toBe(true);

		unlock();
		touch("touchstart", page, 20, 400);
		expect(touch("touchmove", page, 20, 300)).toBe(false);
	});

	it("lets a scrollable panel inside the modal keep scrolling", () => {
		const list = scroller(800, 200, 100);
		const unlock = lockBodyScroll();

		// room above and below, so both directions are the list's to take
		touch("touchstart", list, 20, 400);
		expect(touch("touchmove", list, 20, 300)).toBe(false);
		touch("touchstart", list, 20, 300);
		expect(touch("touchmove", list, 20, 400)).toBe(false);

		unlock();
	});

	it("cancels once that panel has run out of room, rather than chaining to the page", () => {
		const list = scroller(800, 200, 0);
		const unlock = lockBodyScroll();

		// at the top: pulling down has nowhere to go, pushing up does
		touch("touchstart", list, 20, 300);
		expect(touch("touchmove", list, 20, 400)).toBe(true);
		touch("touchstart", list, 20, 400);
		expect(touch("touchmove", list, 20, 300)).toBe(false);

		unlock();
	});

	it("does not mistake an overflowing box for one that scrolls", () => {
		// a drawer handle is a small bar wrapping a larger hit area: it overflows
		// without ever scrolling, and must not be taken for a list
		const bar = document.createElement("div");
		Object.defineProperties(bar, {
			scrollHeight: { value: 44, configurable: true },
			clientHeight: { value: 6, configurable: true },
		});
		document.body.appendChild(bar);
		const unlock = lockBodyScroll();

		touch("touchstart", bar, 20, 400);
		expect(touch("touchmove", bar, 20, 300)).toBe(true);

		unlock();
	});
});
