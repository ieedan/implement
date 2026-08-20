// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, ForEach } from "@implementjs/core";
import {
	createToastManager,
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "../src/index";

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

describe("ToastManager", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("adds toasts frontmost first and returns their ids", () => {
		const manager = createToastManager();
		const first = manager.add({ title: "First" });
		const second = manager.add({ title: "Second" });
		expect(manager.toasts.get().map((t) => t.id)).toEqual([second, first]);
	});

	it("auto-dismisses after the default timeout", () => {
		const manager = createToastManager();
		manager.add({ title: "Hello" });
		vi.advanceTimersByTime(4999);
		expect(manager.toasts.get()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("keeps timeout: 0 toasts until closed", () => {
		const manager = createToastManager();
		const id = manager.add({ title: "Sticky", timeout: 0 });
		vi.advanceTimersByTime(60_000);
		expect(manager.toasts.get()).toHaveLength(1);
		manager.close(id);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("updates a toast in place when adding with an existing id", () => {
		const manager = createToastManager();
		const id = manager.add({ title: "One" });
		manager.add({ id, title: "Two" });
		const toasts = manager.toasts.get();
		expect(toasts).toHaveLength(1);
		expect(toasts[0]!.title).toBe("Two");
	});

	it("restarts the clock when a toast is updated", () => {
		const manager = createToastManager();
		const id = manager.add({ title: "One" });
		vi.advanceTimersByTime(4000);
		manager.update(id, { title: "Two" });
		vi.advanceTimersByTime(4000);
		expect(manager.toasts.get()).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("does not run clocks for toasts beyond the limit", () => {
		const manager = createToastManager({ limit: 2, timeout: 1000 });
		const first = manager.add({ title: "1" });
		manager.add({ title: "2" });
		manager.add({ title: "3" });

		// `first` is now index 2 — outside the limit, so its clock is frozen
		vi.advanceTimersByTime(999);
		expect(manager.toasts.get()).toHaveLength(3);
		vi.advanceTimersByTime(1);
		// the two visible toasts expired; the limited one surfaced with its time intact
		expect(manager.toasts.get().map((t) => t.id)).toEqual([first]);
		vi.advanceTimersByTime(999);
		expect(manager.toasts.get()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("pauses and resumes with remaining time", () => {
		const manager = createToastManager({ timeout: 1000 });
		manager.add({ title: "Hello" });
		vi.advanceTimersByTime(600);
		manager.pause("hover");
		vi.advanceTimersByTime(10_000);
		expect(manager.toasts.get()).toHaveLength(1);
		manager.resume("hover");
		vi.advanceTimersByTime(399);
		expect(manager.toasts.get()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("stays paused until every reason is resumed", () => {
		const manager = createToastManager({ timeout: 1000 });
		manager.add({ title: "Hello" });
		manager.pause("hover");
		manager.pause("focus");
		manager.resume("hover");
		vi.advanceTimersByTime(5000);
		expect(manager.toasts.get()).toHaveLength(1);
		manager.resume("focus");
		vi.advanceTimersByTime(1000);
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("close() with no id closes everything", () => {
		const manager = createToastManager();
		manager.add({ title: "1" });
		manager.add({ title: "2" });
		manager.close();
		expect(manager.toasts.get()).toHaveLength(0);
	});

	it("calls onClose then onRemove", () => {
		const manager = createToastManager();
		const order: string[] = [];
		const id = manager.add({
			title: "Hello",
			onClose: () => order.push("close"),
			onRemove: () => order.push("remove"),
		});
		manager.close(id);
		expect(order).toEqual(["close", "remove"]);
	});

	it("promise() walks loading → success and keeps the value", async () => {
		vi.useRealTimers();
		const manager = createToastManager();
		const result = manager.promise(Promise.resolve(42), {
			loading: "Loading…",
			success: (n) => `Got ${n}`,
			error: "Failed",
		});

		expect(manager.toasts.get()[0]).toMatchObject({ type: "loading", title: "Loading…" });
		await expect(result).resolves.toBe(42);
		await tick();
		expect(manager.toasts.get()[0]).toMatchObject({ type: "success", title: "Got 42" });
	});

	it("promise() walks loading → error and still rejects", async () => {
		vi.useRealTimers();
		const manager = createToastManager();
		const failure = new Error("nope");
		const result = manager.promise(Promise.reject(failure), {
			loading: "Loading…",
			success: "Done",
			error: (e) => `Error: ${(e as Error).message}`,
		});

		await expect(result).rejects.toBe(failure);
		await tick();
		expect(manager.toasts.get()[0]).toMatchObject({ type: "error", title: "Error: nope" });
	});
});

describe("Toast parts", () => {
	function Toaster(manager: ReturnType<typeof createToastManager>) {
		return ToastProvider(
			{ manager },
			ToastViewport(
				{},
				ForEach(
					manager.toasts,
					(t) => t.id,
					(toast) =>
						Toast(
							{ toast },
							ToastTitle(
								{},
								toast.bind((t) => t.title ?? ""),
							),
							ToastDescription(
								{},
								toast.bind((t) => t.description ?? ""),
							),
							ToastClose({}, "Close"),
						),
				),
			),
		);
	}

	it("renders toasts with state, type, and stacking attributes", async () => {
		const manager = createToastManager();
		const { target, unmount } = await mount(Toaster(manager));

		manager.add({ title: "Saved", description: "Your changes were saved.", type: "success" });
		manager.add({ title: "Second" });
		await tick();

		const roots = target.querySelectorAll("[data-toast-root]");
		expect(roots).toHaveLength(2);

		// the list is newest first, so the first root is the frontmost toast
		const front = roots[0]! as HTMLElement;
		expect(front.dataset.state).toBe("open");
		expect(front.getAttribute("role")).toBe("status");
		expect(front.style.getPropertyValue("--toast-index")).toBe("0");
		expect(front.hasAttribute("data-behind")).toBe(false);
		expect(front.querySelector("[data-toast-title]")!.textContent).toBe("Second");

		const behind = roots[1]! as HTMLElement;
		expect(behind.dataset.type).toBe("success");
		expect(behind.style.getPropertyValue("--toast-index")).toBe("1");
		expect(behind.hasAttribute("data-behind")).toBe(true);

		const title = behind.querySelector("[data-toast-title]")!;
		expect(title.textContent).toBe("Saved");
		expect(behind.getAttribute("aria-labelledby")).toBe(title.id);

		unmount();
	});

	it("re-stacks live as later toasts arrive and leave", async () => {
		const manager = createToastManager();
		const { target, unmount } = await mount(Toaster(manager));

		manager.add({ title: "First" });
		await tick();
		const first = target.querySelector("[data-toast-root]") as HTMLElement;
		expect(first.style.getPropertyValue("--toast-index")).toBe("0");

		const second = manager.add({ title: "Second" });
		await tick();
		expect(first.style.getPropertyValue("--toast-index")).toBe("1");
		expect(first.hasAttribute("data-behind")).toBe(true);

		manager.close(second);
		await tick();
		expect(first.style.getPropertyValue("--toast-index")).toBe("0");
		expect(first.hasAttribute("data-behind")).toBe(false);

		unmount();
	});

	it("close removes the element (no transition in tests)", async () => {
		const manager = createToastManager();
		const { target, unmount } = await mount(Toaster(manager));

		const id = manager.add({ title: "Hello" });
		await tick();
		expect(target.querySelectorAll("[data-toast-root]")).toHaveLength(1);

		manager.close(id);
		await tick();
		expect(target.querySelectorAll("[data-toast-root]")).toHaveLength(0);
		expect(manager.toasts.get()).toHaveLength(0);

		unmount();
	});

	it("the close button dismisses its own toast", async () => {
		const manager = createToastManager();
		const { target, unmount } = await mount(Toaster(manager));

		manager.add({ title: "One" });
		manager.add({ title: "Two" });
		await tick();

		const close = target.querySelector("[data-toast-close]") as HTMLButtonElement;
		close.click();
		await tick();

		const roots = target.querySelectorAll("[data-toast-root]");
		expect(roots).toHaveLength(1);
		expect(roots[0]!.querySelector("[data-toast-title]")!.textContent).toBe("One");

		unmount();
	});

	it("marks toasts beyond the limit", async () => {
		const manager = createToastManager({ limit: 2 });
		const { target, unmount } = await mount(Toaster(manager));

		manager.add({ title: "1" });
		manager.add({ title: "2" });
		manager.add({ title: "3" });
		await tick();

		const limited = target.querySelectorAll("[data-toast-root][data-limited]");
		expect(limited).toHaveLength(1);
		expect(limited[0]!.querySelector("[data-toast-title]")!.textContent).toBe("1");

		unmount();
	});

	it("Escape on a toast dismisses it", async () => {
		const manager = createToastManager();
		const { target, unmount } = await mount(Toaster(manager));

		manager.add({ title: "Hello" });
		await tick();

		const root = target.querySelector("[data-toast-root]") as HTMLElement;
		root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await tick();
		expect(target.querySelectorAll("[data-toast-root]")).toHaveLength(0);

		unmount();
	});
});
