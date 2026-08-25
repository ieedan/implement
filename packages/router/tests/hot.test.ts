// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, Div, navigateTo, Span, type Child, type Mountable } from "@implementjs/core";
import { refreshRouters, Router } from "../src/index";

/** Lets a test mount, drive and tear down a router the way an app does. */
function mount(router: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(router);
	return {
		target,
		text: () => target.textContent,
		// `onMount` is deferred a microtask, and that is where a router registers
		// itself as refreshable — the same gap a hot update lands well after
		settled: () => Promise.resolve(),
		dispose: () => {
			unmount();
			target.remove();
		},
	};
}

describe("refreshRouters", () => {
	it("re-renders from the given depth, leaving what is above it mounted", async () => {
		navigateTo("/docs");
		// what a hot-replaced module swaps: the render closes over these, so
		// changing one and refreshing is exactly what `hotReplaceRoute` does
		let pageText = "page one";
		let layoutMounts = 0;
		const routes = {
			layout: (children: Mountable): Child => {
				layoutMounts++;
				return Div(Span("chrome "), children);
			},
			"/docs": () => Span(pageText),
		};
		const view = mount(Router(routes));
		await view.settled();
		expect(view.text()).toBe("chrome page one");
		expect(layoutMounts).toBe(1);

		pageText = "page two";
		expect(refreshRouters(() => 1)).toBe(true);
		expect(view.text()).toBe("chrome page two");
		// the layout never re-ran: its DOM, its subscriptions and its state stayed
		expect(layoutMounts).toBe(1);

		expect(refreshRouters(() => 0)).toBe(true);
		expect(layoutMounts).toBe(2);

		view.dispose();
	});

	it("leaves a router alone when the depth comes back negative", async () => {
		navigateTo("/docs");
		let pageText = "before";
		const view = mount(Router({ "/docs": () => Span(pageText) }));
		await view.settled();

		pageText = "after";
		expect(refreshRouters(() => -1)).toBe(false);
		expect(view.text()).toBe("before");

		view.dispose();
	});

	it("passes each router the path it is showing", async () => {
		navigateTo("/docs/components");
		const view = mount(Router({ "/docs/:slug": () => Span("page") }));
		await view.settled();

		const seen: string[] = [];
		refreshRouters((path) => {
			seen.push(path);
			return -1;
		});
		expect(seen).toEqual(["/docs/components"]);

		view.dispose();
	});

	it("clamps a depth past the end of the chain onto the page", async () => {
		navigateTo("/docs");
		let pageText = "before";
		let layoutMounts = 0;
		const view = mount(
			Router({
				layout: (children: Mountable): Child => {
					layoutMounts++;
					return Div(children);
				},
				"/docs": () => Span(pageText),
			}),
		);
		await view.settled();
		expect(layoutMounts).toBe(1);

		pageText = "after";
		expect(refreshRouters(() => 99)).toBe(true);
		expect(view.text()).toBe("after");
		expect(layoutMounts).toBe(1);

		view.dispose();
	});

	it("puts the match back when the edit fixes what the render threw", async () => {
		navigateTo("/docs");
		let broken = true;
		const view = mount(
			Router(
				{
					layout: (children: Mountable): Child => Div(Span("chrome "), children),
					"/docs": () => {
						if (broken) throw new Error("kaboom");
						return Span("fixed");
					},
				},
				{ fallback: (error) => Span(`${error.code}: ${error.message}`), onError: () => {} },
			),
		);
		await view.settled();
		expect(view.text()).toBe("500: kaboom");

		broken = false;
		expect(refreshRouters(() => 1)).toBe(true);
		// the fallback replaced the whole chain, so recovery rebuilds all of it
		expect(view.text()).toBe("chrome fixed");

		view.dispose();
	});

	it("stays on the fallback for a path that matches no route", async () => {
		navigateTo("/nowhere");
		const view = mount(
			Router({ "/docs": () => Span("page") }, { fallback: () => Span("not found") }),
		);
		await view.settled();
		expect(view.text()).toBe("not found");

		// no route module can put a page at a path the table has no entry for;
		// adding one regenerates the router and reloads
		expect(refreshRouters(() => 0)).toBe(false);
		expect(view.text()).toBe("not found");

		view.dispose();
	});

	it("forgets a router once it unmounts", async () => {
		navigateTo("/docs");
		const view = mount(Router({ "/docs": () => Span("page") }));
		await view.settled();
		view.dispose();

		const asked: string[] = [];
		expect(
			refreshRouters((path) => {
				asked.push(path);
				return 0;
			}),
		).toBe(false);
		expect(asked).toEqual([]);
	});
});
