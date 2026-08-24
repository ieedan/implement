// @vitest-environment happy-dom
import { App, signal } from "@implementjs/core";
import { PlusIcon } from "@implementjs/lucide";
import { afterEach, expect, it } from "vitest";
import { Button } from "../src/lib/components/ui/button";
import type { Child } from "@implementjs/core";

let cleanup: (() => void) | null = null;

/** Mount one button and hand back the element it rendered. */
function mount(child: Child): HTMLButtonElement {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const unmount = App({ target }).render(child);

	cleanup = () => {
		unmount();
		target.remove();
	};

	const button = target.querySelector("button");
	if (!button) throw new Error("expected a button");
	return button;
}

/** A promise plus the handle to settle it, so a test decides when the work finishes. */
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

/** Let the microtasks a settled promise queues run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
	cleanup?.();
	cleanup = null;
});

it("spins, disables, and announces itself while loading", () => {
	const button = mount(Button({ loading: true }, "Saving"));

	expect(button.querySelector("[data-slot='spinner']")).not.toBeNull();
	expect(button.disabled).toBe(true);
	expect(button.getAttribute("data-loading")).toBe("true");
	expect(button.getAttribute("aria-busy")).toBe("true");
	expect(button.textContent).toContain("Saving");
});

it("leaves no trace of the loading state when it is not loading", () => {
	const button = mount(Button("Save"));

	expect(button.querySelector("[data-slot='spinner']")).toBeNull();
	expect(button.disabled).toBe(false);
	expect(button.hasAttribute("data-loading")).toBe(false);
	expect(button.hasAttribute("aria-busy")).toBe(false);
});

it("follows a signal in and out of the loading state", () => {
	const loading = signal(false);
	const button = mount(Button({ loading }, "Save"));

	expect(button.querySelector("[data-slot='spinner']")).toBeNull();

	loading.set(true);
	expect(button.querySelector("[data-slot='spinner']")).not.toBeNull();
	expect(button.disabled).toBe(true);

	loading.set(false);
	expect(button.querySelector("[data-slot='spinner']")).toBeNull();
	expect(button.disabled).toBe(false);
	expect(button.hasAttribute("data-loading")).toBe(false);
});

it("stays disabled while it loads even if the caller says otherwise", () => {
	const button = mount(Button({ loading: true, disabled: false }, "Save"));

	expect(button.disabled).toBe(true);
});

it("loads until the promise a click returns settles", async () => {
	const work = deferred();
	const button = mount(Button({ onClickPromise: () => work.promise }, "Save"));

	button.click();
	expect(button.disabled).toBe(true);
	expect(button.querySelector("[data-slot='spinner']")).not.toBeNull();

	work.resolve();
	await flush();

	expect(button.disabled).toBe(false);
	expect(button.querySelector("[data-slot='spinner']")).toBeNull();
});

it("ignores a second click while the first is still in flight", () => {
	const work = deferred();
	let calls = 0;
	const button = mount(
		Button(
			{
				onClickPromise: () => {
					calls++;
					return work.promise;
				},
			},
			"Save",
		),
	);

	button.click();
	// the button is disabled by now, so only a programmatic click gets this far
	button.click();

	expect(calls).toBe(1);
});

it("runs onClick first and leaves a non-promise handler alone", () => {
	const seen: string[] = [];
	const button = mount(
		Button(
			{
				onClick: () => seen.push("click"),
				onClickPromise: () => {
					seen.push("promise");
					return "not a promise";
				},
			},
			"Save",
		),
	);

	button.click();

	expect(seen).toEqual(["click", "promise"]);
	expect(button.disabled).toBe(false);
	expect(button.querySelector("[data-slot='spinner']")).toBeNull();
});

it("keeps a signal-driven loading state through a click that resolves", async () => {
	const work = deferred();
	const loading = signal(true);
	const button = mount(Button({ loading, onClickPromise: () => work.promise }, "Save"));

	expect(button.disabled).toBe(true);

	work.resolve();
	await flush();

	// the prop is still true, so the promise settling is not the last word
	expect(button.disabled).toBe(true);
	loading.set(false);
	expect(button.disabled).toBe(false);
});

it("swaps an icon button's icon for the spinner", () => {
	const loading = signal(false);
	const button = mount(
		Button(
			{ size: "icon", "aria-label": "Add", loading },
			PlusIcon({ "aria-hidden": true, class: "plus" }),
		),
	);

	expect(button.querySelector(".plus")).not.toBeNull();

	loading.set(true);
	expect(button.querySelector(".plus")).toBeNull();
	expect(button.querySelector("[data-slot='spinner']")).not.toBeNull();

	loading.set(false);
	expect(button.querySelector(".plus")).not.toBeNull();
});

it("keeps the label beside the spinner at every other size", () => {
	const button = mount(Button({ size: "sm", loading: true }, "Saving"));

	expect(button.querySelector("[data-slot='spinner']")).not.toBeNull();
	expect(button.textContent).toContain("Saving");
});
