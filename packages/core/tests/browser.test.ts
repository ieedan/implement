// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import {
	App,
	Button,
	Div,
	derived,
	If,
	ImplementEffect,
	ImplementLifecycle,
	Input,
	navigateTo,
	ref,
	registerNavigationGuard,
	Router,
	signal,
	Span,
	type RouterLocation,
} from "../src/index";

describe("server markup without hydration installed", () => {
	it("discards it, mounts fresh, and says so", () => {
		const target = document.createElement("div");
		// what the Vite plugin injects: the server's tree inside a marked wrapper
		target.innerHTML = '<div data-ssr=""><p id="stale">from the server</p></div>';
		document.body.appendChild(target);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const app = App({ target });
		const unmount = app.render(Div({ id: "fresh" }, "from the client"));

		// the server tree is gone rather than adopted un-hydrated, and the client
		// tree is the only thing left standing
		expect(target.querySelector("#stale")).toBeNull();
		expect(target.querySelector("[data-ssr]")).toBeNull();
		expect(target.querySelector("#fresh")?.textContent).toBe("from the client");
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("hydration is not installed"));

		unmount();
		warn.mockRestore();
		target.remove();
	});
});

describe("browser mounting", () => {
	it("mounts, reacts to signals, and unmounts", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const count = signal(0);

		const unmount = app.render(
			Div(
				{ id: "root" },
				Span(count),
				If(
					count.bind((value) => value > 0),
					Span("pos"),
				),
			),
		);

		const root = target.querySelector("#root");
		expect(root).not.toBeNull();
		expect(root!.textContent).toBe("0");

		count.set(2);
		expect(root!.textContent).toBe("2pos");

		unmount();
		expect(target.innerHTML).toBe("");
		target.remove();
	});

	it("swaps server-rendered [data-ssr] markup for the client mount", () => {
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr style="display: contents"><h1>server</h1></div>`;
		document.body.appendChild(target);
		const app = App({ target });

		const unmount = app.render(Div({ id: "client" }, "client"));

		expect(target.querySelector("[data-ssr]")).toBeNull();
		expect(target.textContent).toBe("client");

		unmount();
		target.remove();
	});

	it("attaches event handlers", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const count = signal(0);

		const unmount = app.render(Button({ onClick: () => count.increment() }, "add"));
		target.querySelector("button")!.click();
		expect(count.get()).toBe(1);

		unmount();
		target.remove();
	});

	it("keeps a parent's `this` ref readable while its children unmount", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const el = ref<HTMLDivElement>();
		const seen: (HTMLElement | null)[] = [];

		const unmount = app.render(
			Div(
				{ this: el },
				ImplementLifecycle({ onUnmount: () => seen.push(el.get()) }, Span("child")),
			),
		);

		const root = target.querySelector("div");
		expect(el.get()).toBe(root);

		unmount();
		expect(seen).toEqual([root]);
		expect(el.get()).toBeNull();
		target.remove();
	});
});

describe("ImplementEffect", () => {
	it("runs on mount by default and skips that run with `immediate: false`", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const query = signal("a");
		const eager: string[] = [];
		const lazy: string[] = [];

		const unmount = app.render(
			Div(
				ImplementEffect([query], (q) => eager.push(q)),
				ImplementEffect([query], (q) => lazy.push(q), { immediate: false }),
			),
		);

		expect(eager).toEqual(["a"]);
		expect(lazy).toEqual([]);

		query.set("b");
		expect(eager).toEqual(["a", "b"]);
		expect(lazy).toEqual(["b"]);

		// both stop with the tree
		unmount();
		query.set("c");
		expect(eager).toEqual(["a", "b"]);
		expect(lazy).toEqual(["b"]);
		target.remove();
	});

	it("skips the values a remount subscribes with, not the changes after it", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const shown = signal(true);
		const query = signal("a");
		const seen: string[] = [];

		const unmount = app.render(
			Div(
				If(
					shown,
					ImplementEffect([query], (q) => seen.push(q), { immediate: false }),
				),
			),
		);

		expect(seen).toEqual([]);

		// changes while the branch is hidden are not replayed when it comes back
		shown.set(false);
		query.set("b");
		shown.set(true);
		expect(seen).toEqual([]);

		query.set("c");
		expect(seen).toEqual(["c"]);

		unmount();
		target.remove();
	});
});

describe("reactive sources that forward subscribe", () => {
	// Every reactive shape a row uses at once. Bound props take a fast path
	// that registers with a source's own subscriber table; a source that
	// forwards `subscribe` elsewhere never notifies that table, so anything
	// bound through one silently stops updating while unit-level signal tests
	// still pass. Each assertion below is a source that must not take it.
	it("updates text, class, and props bound through them", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const item = signal({ title: "first", priority: "low", done: false });
		const selected = signal(0);

		const unmount = app.render(
			Div(
				{
					id: "row",
					// derived: lazy, activates only while something listens
					class: derived(
						[item, selected],
						(value, current) =>
							`row${value.done ? " done" : ""}${current === 1 ? " selected" : ""}`,
					),
				},
				// bind(path): a signal that forwards subscribe to its parent
				Span({ id: "title" }, item.bind("title")),
				// bind(selector): a view that is not a notifier at all
				Span({ id: "badge", class: item.bind((value) => `badge ${value.priority}`) }),
				// bound prop rather than a child
				Input({ id: "check", type: "checkbox", checked: item.bind((value) => value.done) }),
			),
		);

		const row = () => target.querySelector("#row")!;
		const title = () => target.querySelector("#title")!;
		const badge = () => target.querySelector("#badge")!;
		const check = () => target.querySelector("#check") as HTMLInputElement;

		expect(title().textContent).toBe("first");
		expect(badge().getAttribute("class")).toBe("badge low");
		expect(row().getAttribute("class")).toBe("row");
		expect(check().checked).toBe(false);

		item.set({ title: "second", priority: "high", done: true });
		expect(title().textContent).toBe("second");
		expect(badge().getAttribute("class")).toBe("badge high");
		expect(row().getAttribute("class")).toBe("row done");
		expect(check().checked).toBe(true);

		// a shared source the derived also watches, changing on its own
		selected.set(1);
		expect(row().getAttribute("class")).toBe("row done selected");

		unmount();
		target.remove();
	});
});

describe("navigation guards", () => {
	it("cancels navigation while a guard refuses, and resumes once it allows or unregisters", () => {
		const seen: RouterLocation[] = [];
		let allow = false;
		const unregister = registerNavigationGuard((to) => {
			seen.push(to);
			return allow;
		});

		const before = window.location.pathname;
		navigateTo("/guarded");
		expect(window.location.pathname).toBe(before);
		expect(seen[0]!.path).toBe("/guarded");

		allow = true;
		navigateTo("/guarded");
		expect(window.location.pathname).toBe("/guarded");

		unregister();
		allow = false;
		navigateTo("/unguarded");
		expect(window.location.pathname).toBe("/unguarded");
		expect(seen).toHaveLength(2);
	});
});

describe("router onError", () => {
	it("routes render errors to onError instead of the console, then shows the fallback", () => {
		navigateTo("/boom");
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });

		const thrown: unknown[] = [];
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const router = Router(
			{
				"/boom": () => {
					throw new Error("kaboom");
				},
			},
			{
				fallback: (error) => Span(`${error.code}: ${error.message}`),
				onError: (error) => thrown.push(error),
			},
		);

		const unmount = app.render(router);
		expect(target.textContent).toBe("500: kaboom");
		expect(thrown).toHaveLength(1);
		expect((thrown[0] as Error).message).toBe("kaboom");
		expect(consoleSpy).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
		unmount();
		target.remove();
	});
});
