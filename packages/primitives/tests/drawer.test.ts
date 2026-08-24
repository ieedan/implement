// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, Button, signal } from "@implementjs/core";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerHandle,
	DrawerOverlay,
	DrawerTrigger,
	type DrawerRootProps,
} from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

const mounted: (() => void)[] = [];

async function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(tree);
	mounted.push(() => {
		unmount();
		target.remove();
	});
	await tick();
	return { target };
}

/**
 * A failed assertion must not leave a drawer mounted: the next test's focus
 * lands in it, and two focus traps arguing is a stack overflow, not a failure
 * anyone can read.
 */
function unmountAll() {
	vi.useRealTimers();
	for (const unmount of mounted.splice(0)) unmount();
	document.body.removeAttribute("style");
	document.documentElement.removeAttribute("data-drawer-open");
	document.documentElement.removeAttribute("style");
}

function element(target: ParentNode, selector: string, index = 0): HTMLElement {
	const el = target.querySelectorAll(selector)[index];
	if (!(el instanceof HTMLElement)) throw new Error(`No ${selector} at ${index}`);
	return el;
}

/**
 * A real scroll container: `overflow-y: auto` and content taller than the box.
 * happy-dom has no layout, so the sizes are declared rather than measured.
 */
function scrollable(scrollHeight: number, clientHeight: number, scrollTop: number): HTMLElement {
	const el = document.createElement("div");
	el.setAttribute("data-scroller", "");
	el.style.overflowY = "auto";
	Object.defineProperties(el, {
		scrollHeight: { value: scrollHeight, configurable: true },
		clientHeight: { value: clientHeight, configurable: true },
	});
	el.scrollTop = scrollTop;
	return el;
}

/**
 * Something that overflows without scrolling — the shape of the drawer's own
 * grab bar, whose 44px hit area sticks out of a 6px bar.
 */
function overflowing(scrollHeight: number, clientHeight: number): HTMLElement {
	const el = document.createElement("div");
	el.setAttribute("data-overflowing", "");
	Object.defineProperties(el, {
		scrollHeight: { value: scrollHeight, configurable: true },
		clientHeight: { value: clientHeight, configurable: true },
		scrollWidth: { value: scrollHeight, configurable: true },
		clientWidth: { value: clientHeight, configurable: true },
	});
	return el;
}

/** happy-dom has no layout, so the panel reports the size the test wants it to. */
function sizePanel(el: HTMLElement, height: number) {
	Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
	Object.defineProperty(el, "offsetWidth", { value: window.innerWidth, configurable: true });
}

/** Runs `fn` with the clock stopped at `at`, which is how velocity is faked. */
function at<T>(time: number, fn: () => T): T {
	const now = Date.now;
	Date.now = () => time;
	try {
		return fn();
	} finally {
		Date.now = now;
	}
}

type Point = { x?: number; y?: number; type?: string };

function pointer(type: string, { x = 0, y = 0, type: pointerType = "mouse" }: Point = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, {
		pointerId: 1,
		pointerType,
		button: 0,
		clientX: x,
		clientY: y,
	});
	return event;
}

/**
 * A press, a move, and a release, `ms` apart. The whole gesture happens well
 * after the mount so it is not inside the drawer's open-animation grace.
 */
function drag(el: HTMLElement, from: Point, to: Point, ms = 1000) {
	const start = Date.now() + 10_000;
	at(start, () => {
		el.dispatchEvent(pointer("pointerdown", from));
		el.dispatchEvent(pointer("pointermove", to));
	});
	at(start + ms, () => el.dispatchEvent(pointer("pointerup", to)));
}

/** Press and move without releasing, so the panel is left mid-drag. */
function dragTo(el: HTMLElement, from: Point, to: Point) {
	at(Date.now() + 10_000, () => {
		el.dispatchEvent(pointer("pointerdown", from));
		el.dispatchEvent(pointer("pointermove", to));
	});
}

function offsetY(el: HTMLElement): string {
	return el.style.getPropertyValue("--ip-drawer-offset-y");
}

function DrawerFixture(props: DrawerRootProps = {}) {
	return Drawer(
		{ open: true, ...props },
		DrawerTrigger({}, "Open"),
		DrawerOverlay({}),
		DrawerContent({}, "Panel"),
	);
}

describe("drawer", () => {
	afterEach(unmountAll);

	it("renders the modal wiring the dialog gets, plus the direction", async () => {
		const { target } = await mount(DrawerFixture({ direction: "right" }));

		const content = element(target, "[data-drawer-content]");
		expect(content.getAttribute("role")).toBe("dialog");
		expect(content.getAttribute("aria-modal")).toBe("true");
		expect(content.getAttribute("data-state")).toBe("open");
		expect(content.getAttribute("data-drawer-direction")).toBe("right");
		expect(content.hasAttribute("data-snap-points")).toBe(false);
		expect(element(target, "[data-drawer-overlay]").getAttribute("data-state")).toBe("open");
	});

	it("dismisses when a slow drag passes the close threshold", async () => {
		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open }));
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		drag(content, { y: 0 }, { y: 80 });
		expect(open.get()).toBe(true);

		drag(content, { y: 0 }, { y: 300 });
		expect(open.get()).toBe(false);
	});

	it("dismisses on a fast flick that never reaches the threshold", async () => {
		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open }));
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		drag(content, { y: 0 }, { y: 60 }, 20);
		expect(open.get()).toBe(false);
	});

	it("springs back instead of closing when it is not dismissible", async () => {
		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open, dismissible: false }));
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		drag(content, { y: 0 }, { y: 300 }, 20);
		expect(open.get()).toBe(true);
		expect(offsetY(content)).toBe("0px");
	});

	it("refuses every close it owns when it is not dismissible", async () => {
		const open = signal(true);
		const { target } = await mount(
			Drawer(
				{ open, dismissible: false },
				DrawerTrigger({}, "Open"),
				DrawerOverlay({}),
				DrawerContent({}, DrawerClose({}, "Done")),
			),
		);
		const content = element(target, "[data-drawer-content]");

		element(content, "[data-drawer-close], button").click();
		expect(open.get()).toBe(true);

		content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(open.get()).toBe(true);

		element(target, "[data-drawer-overlay]").dispatchEvent(
			new MouseEvent("pointerdown", { bubbles: true }),
		);
		expect(open.get()).toBe(true);

		// the signal is the way out, which is what `dismissible: false` is for
		open.set(false);
		expect(open.get()).toBe(false);
	});

	it("tracks the drag on the panel and fades the overlay with it", async () => {
		const { target } = await mount(DrawerFixture());
		const content = element(target, "[data-drawer-content]");
		const overlay = element(target, "[data-drawer-overlay]");
		sizePanel(content, 400);
		dragTo(content, { y: 0 }, { y: 100 });

		expect(content.getAttribute("data-dragging")).toBe("");
		expect(offsetY(content)).toBe("100px");
		expect(content.style.getPropertyValue("--ip-drawer-progress")).toBe("0.25");
		expect(overlay.style.getPropertyValue("--ip-drawer-fade")).toBe("0.75");

		content.dispatchEvent(pointer("pointerup", { y: 100 }));
		expect(content.hasAttribute("data-dragging")).toBe(false);
	});

	it("rubber bands a drag that carries on past the open position", async () => {
		const { target } = await mount(DrawerFixture());
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		at(Date.now() + 10_000, () => {
			content.dispatchEvent(pointer("pointerdown", { y: 0 }));
			content.dispatchEvent(pointer("pointermove", { y: 40 }));
			content.dispatchEvent(pointer("pointermove", { y: -60 }));
		});

		const offset = Number.parseFloat(offsetY(content));
		expect(offset).toBeLessThan(0);
		expect(offset).toBeGreaterThan(-60);
	});

	it("will not start a drag back past the open position, so the content can scroll", async () => {
		const { target } = await mount(DrawerFixture());
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		dragTo(content, { y: 200 }, { y: 100 });

		expect(content.hasAttribute("data-dragging")).toBe(false);
		expect(offsetY(content)).toBe("0px");
	});

	it("does not drag from a scroll container that is scrolled away from the edge", async () => {
		const { target } = await mount(DrawerFixture());
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		content.appendChild(scrollable(800, 200, 120));

		dragTo(element(content, "[data-scroller]"), { y: 0 }, { y: 100 });
		expect(content.hasAttribute("data-dragging")).toBe(false);
		expect(offsetY(content)).toBe("0px");
	});

	it("does not click what a drag started on", async () => {
		let clicks = 0;
		const { target } = await mount(
			Drawer({ open: true }, DrawerContent({}, Button({ onClick: () => clicks++ }, "Submit"))),
		);
		const content = element(target, "[data-drawer-content]");
		const button = element(content, "button");
		sizePanel(content, 400);

		button.click();
		expect(clicks).toBe(1);

		drag(button, { y: 0 }, { y: 60 });
		button.click();
		expect(clicks).toBe(1);

		// and the next real click still lands
		button.click();
		expect(clicks).toBe(2);
	});

	it("dismisses in every direction, not only the ones the axis runs forward in", async () => {
		for (const [direction, from, to] of [
			["bottom", { y: 0 }, { y: 300 }],
			["top", { y: 300 }, { y: 0 }],
			["right", { x: 0 }, { x: 300 }],
			["left", { x: 300 }, { x: 0 }],
		] as const) {
			const open = signal(true);
			const { target } = await mount(DrawerFixture({ open, direction }));
			const content = element(target, "[data-drawer-content]");
			sizePanel(content, 400);

			drag(content, from, to);
			expect(open.get(), direction).toBe(false);
			unmountAll();
		}
	});

	it("does not take the handle's oversized hit area for a scroll container", async () => {
		// the bar is 6px and its hit area is 44px, so it overflows without ever
		// scrolling — and a top drawer, which drags away from the far edge, used
		// to read that as a list scrolled away from the edge and refuse to drag
		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open, direction: "top" }));
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);
		content.appendChild(overflowing(44, 6));

		drag(element(content, "[data-overflowing]"), { y: 300 }, { y: 0 });
		expect(open.get()).toBe(false);
	});

	it("publishes how much of the viewport a keyboard has taken", async () => {
		// a keyboard shrinks the visual viewport and leaves the layout one alone,
		// which is the only reason its height can be worked out at all
		const layout = window.innerHeight;
		const viewport = { height: layout, offsetTop: 0, listeners: new Map<string, () => void>() };
		vi.stubGlobal("visualViewport", {
			get height() {
				return viewport.height;
			},
			get offsetTop() {
				return viewport.offsetTop;
			},
			addEventListener: (type: string, fn: () => void) => viewport.listeners.set(type, fn),
			removeEventListener: (type: string) => viewport.listeners.delete(type),
		});

		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open }));
		const content = element(target, "[data-drawer-content]");
		const inset = () => content.style.getPropertyValue("--ip-drawer-keyboard-inset");
		vi.useFakeTimers();

		expect(inset()).toBe("0px");

		viewport.height = layout - 336;
		viewport.listeners.get("resize")?.();
		expect(inset()).toBe("336px");

		// the visual viewport scrolls inside the layout one, moving the bottom edge.
		// a shrink is held back until it has stood for a moment — see the handoff
		// test below for what that is protecting against
		viewport.offsetTop = 40;
		viewport.listeners.get("scroll")?.();
		expect(inset()).toBe("336px");
		await vi.advanceTimersByTimeAsync(250);
		expect(inset()).toBe("296px");

		// and it is only the drawer's business while the drawer is open
		open.set(false);
		expect(inset()).toBe("0px");
		expect(viewport.listeners.size).toBe(0);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does not reflow for the keyboard handing off between two fields", async () => {
		// moving focus from one field to the next starts the keyboard dismissing
		// and then brings it straight back. Tracking that dip moves the spacer,
		// and with it every field in the panel, down and back — which is what the
		// reader sees as the keyboard flickering.
		const layout = window.innerHeight;
		const viewport = { height: layout, offsetTop: 0, listeners: new Map<string, () => void>() };
		vi.stubGlobal("visualViewport", {
			get height() {
				return viewport.height;
			},
			get offsetTop() {
				return viewport.offsetTop;
			},
			addEventListener: (type: string, fn: () => void) => viewport.listeners.set(type, fn),
			removeEventListener: (type: string) => viewport.listeners.delete(type),
		});

		const open = signal(true);
		const { target } = await mount(DrawerFixture({ open }));
		const content = element(target, "[data-drawer-content]");
		const inset = () => content.style.getPropertyValue("--ip-drawer-keyboard-inset");
		vi.useFakeTimers();

		const resize = (height: number) => {
			viewport.height = height;
			viewport.listeners.get("resize")?.();
		};

		resize(layout - 336);
		expect(inset()).toBe("336px");

		// the dip, frame by frame, and then the keyboard is back
		resize(layout - 240);
		expect(inset()).toBe("336px");
		await vi.advanceTimersByTimeAsync(80);
		resize(layout - 90);
		expect(inset()).toBe("336px");
		await vi.advanceTimersByTimeAsync(80);
		resize(layout - 336);
		expect(inset()).toBe("336px");

		// and it stays there: the shrink that was waiting was dropped, not deferred
		await vi.advanceTimersByTimeAsync(500);
		expect(inset()).toBe("336px");

		// a keyboard that really goes away still does, once it has stayed away
		resize(layout);
		expect(inset()).toBe("336px");
		await vi.advanceTimersByTimeAsync(250);
		expect(inset()).toBe("0px");

		open.set(false);
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("ignores a drag that started on a no-drag region", async () => {
		const { target } = await mount(DrawerFixture());
		const content = element(target, "[data-drawer-content]");
		sizePanel(content, 400);

		const map = document.createElement("div");
		map.setAttribute("data-drawer-no-drag", "");
		content.appendChild(map);

		dragTo(map, { y: 0 }, { y: 100 });
		expect(content.hasAttribute("data-dragging")).toBe(false);
	});
});

describe("drawer snap points", () => {
	const snapPoints = [0.25, 0.5, 1];

	afterEach(unmountAll);

	it("rests at the first snap point and reports where it sits", async () => {
		const { target } = await mount(DrawerFixture({ snapPoints }));
		const content = element(target, "[data-drawer-content]");

		expect(content.hasAttribute("data-snap-points")).toBe(true);
		expect(content.getAttribute("data-snap-point")).toBe("0");
		expect(offsetY(content)).toBe(`${window.innerHeight * 0.75}px`);
	});

	it("snaps to the closest point when a slow drag ends between two", async () => {
		const active = signal<number | string | null>(0.5);
		const { target } = await mount(DrawerFixture({ snapPoints, activeSnapPoint: active }));
		const content = element(target, "[data-drawer-content]");
		const half = window.innerHeight * 0.5;

		// a nudge toward the quarter point, ending nearer to it than to the half
		drag(content, { y: 0 }, { y: half * 0.6 });
		expect(active.get()).toBe(0.25);
	});

	it("steps one snap point on a flick and closes from the first one", async () => {
		const open = signal(true);
		const active = signal<number | string | null>(0.5);
		const { target } = await mount(DrawerFixture({ open, snapPoints, activeSnapPoint: active }));
		const content = element(target, "[data-drawer-content]");

		drag(content, { y: 100 }, { y: 40 }, 100);
		expect(active.get()).toBe(1);

		drag(content, { y: 0 }, { y: 60 }, 100);
		expect(active.get()).toBe(0.5);

		drag(content, { y: 0 }, { y: 60 }, 100);
		expect(active.get()).toBe(0.25);

		drag(content, { y: 0 }, { y: 60 }, 100);
		expect(open.get()).toBe(false);
	});

	it("reads a px snap point as a length the viewport does not enter into", async () => {
		const { target } = await mount(DrawerFixture({ snapPoints: ["148px", 1] }));
		const content = element(target, "[data-drawer-content]");

		expect(offsetY(content)).toBe(`${window.innerHeight - 148}px`);
	});

	it("keeps the overlay clear below the snap point it fades in from", async () => {
		const active = signal<number | string | null>(0.25);
		const { target } = await mount(
			DrawerFixture({ snapPoints, activeSnapPoint: active, fadeFromIndex: 2 }),
		);
		const overlay = element(target, "[data-drawer-overlay]");

		expect(overlay.style.getPropertyValue("--ip-drawer-fade")).toBe("0");
		expect(overlay.hasAttribute("data-faded-in")).toBe(false);

		active.set(1);
		expect(overlay.style.getPropertyValue("--ip-drawer-fade")).toBe("1");
		expect(overlay.hasAttribute("data-faded-in")).toBe(true);
	});

	it("steps the snap points when the handle is tapped, and closes from the last", async () => {
		const open = signal(true);
		const active = signal<number | string | null>(0.5);
		const { target } = await mount(
			Drawer({ open, snapPoints, activeSnapPoint: active }, DrawerContent({}, DrawerHandle({}))),
		);
		const handle = element(target, "[data-drawer-handle]");

		handle.click();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(active.get()).toBe(1);

		handle.click();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(open.get()).toBe(false);
	});
});
