// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import {
	App,
	Button,
	Div,
	If,
	ImplementLifecycle,
	navigateTo,
	ref,
	registerNavigationGuard,
	Router,
	signal,
	Span,
	type RouterLocation,
} from "../src/index";

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
