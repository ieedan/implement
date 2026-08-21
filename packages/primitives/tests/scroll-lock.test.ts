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
