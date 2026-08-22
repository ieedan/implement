// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
	context,
	App,
	Div,
	Fragment,
	ImplementBoundary,
	ImplementEffect,
	ImplementLifecycle,
	location,
	navigateTo,
	Outlet,
	P,
	Span,
	type Child,
	type RouterLocation,
} from "../src/index";
import { renderToString } from "../src/server/index";

const Theme = context<string>("ThemeContext");

function mount(child: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	return {
		target,
		render: () => app.render(child),
		cleanup: () => target.remove(),
	};
}

const Boom = (): Child => () => ({
	mount() {
		throw new Error("kaboom");
	},
	unmount() {},
	getFirstDomNode: () => null,
});

describe("Outlet", () => {
	it("mounts the children it was created with, and swaps them on set", () => {
		const outlet = Outlet(P("first"));
		const { target, render, cleanup } = mount(Div({ id: "root" }, outlet));
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe("<p>first</p><!---->");

		outlet.set(P("second"));
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>second</p><!---->");

		unmount();
		cleanup();
	});

	it("applies a set from before the mount", () => {
		const outlet = Outlet();
		outlet.set(P("late"));
		const { target, render, cleanup } = mount(Div({ id: "root" }, outlet));
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe("<p>late</p><!---->");

		unmount();
		cleanup();
	});

	it("unmounts the previous children before the new ones mount", () => {
		const torn: string[] = [];
		const Tracked = (name: string) =>
			ImplementLifecycle({ onUnmount: () => torn.push(name) }, P(name));

		const outlet = Outlet(Tracked("a"));
		const { target, render, cleanup } = mount(Div({ id: "root" }, outlet));
		const unmount = render();

		outlet.set(Tracked("b"));
		expect(torn).toEqual(["a"]);
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>b</p><!---->");

		outlet.set();
		expect(torn).toEqual(["a", "b"]);
		expect(target.querySelector("#root")!.innerHTML).toBe("<!---->");

		unmount();
		cleanup();
	});

	it("keeps its children in place among its siblings", () => {
		const outlet = Outlet(P("middle"));
		const { target, render, cleanup } = mount(
			Div({ id: "root" }, Span("before"), outlet, Span("after")),
		);
		const unmount = render();

		outlet.set(P("swapped"), P("extra"));
		expect(target.querySelector("#root")!.innerHTML).toBe(
			"<span>before</span><p>swapped</p><p>extra</p><!----><span>after</span>",
		);

		unmount();
		cleanup();
	});

	it("propagates context into children mounted by set", () => {
		const outlet = Outlet();
		const { target, render, cleanup } = mount(
			Theme.Provide("dark").To(Div({ id: "root" }, outlet)),
		);
		const unmount = render();

		outlet.set(Theme.Use((theme) => Span(theme)));
		expect(target.querySelector("#root")!.textContent).toBe("dark");

		unmount();
		cleanup();
	});

	it("routes an error thrown while it mounts to the boundary above it", async () => {
		const outlet = Outlet(Boom());
		const { target, render, cleanup } = mount(
			ImplementBoundary(Div({ id: "root" }, outlet)).Catch((error) => Span(error.message)),
		);
		const unmount = render();

		// the boundary swaps in its branch a microtask later
		await Promise.resolve();
		expect(target.textContent).toBe("kaboom");

		unmount();
		cleanup();
	});

	it("hands what a later set throws back to its caller", () => {
		const outlet = Outlet(P("fine"));
		const { render, cleanup } = mount(Div({ id: "root" }, outlet));
		const unmount = render();

		expect(() => outlet.set(Boom())).toThrow("kaboom");

		unmount();
		cleanup();
	});

	it("releases its children when an ancestor takes the subtree out", () => {
		const torn: string[] = [];
		const outlet = Outlet(ImplementLifecycle({ onUnmount: () => torn.push("child") }, P("x")));
		const { target, render, cleanup } = mount(Div({ id: "root" }, outlet));
		const unmount = render();

		// the element removes itself and everything under it in one go, so the
		// outlet's own marker never needs removing — its children still do
		unmount();
		expect(torn).toEqual(["child"]);
		expect(target.querySelector("#root")).toBe(null);
		expect(target.innerHTML).toBe("");

		cleanup();
	});

	it("serializes in a server render", () => {
		const outlet = Outlet(P("server"));
		expect(renderToString(Div(outlet)).html).toBe("<div><p>server</p><!----></div>");
	});

	it("serializes what was set before the render", () => {
		const outlet = Outlet();
		outlet.set(P("set"));
		expect(renderToString(Div(outlet)).html).toBe("<div><p>set</p><!----></div>");
	});
});

/**
 * The router from the "custom nodes" page, verbatim enough to keep it honest:
 * if the public surface stops being enough to write this, the page is wrong.
 */
function MiniRouter(routes: Record<string, () => Child>, notFound: () => Child): Child {
	const outlet = Outlet();

	const show = ({ path }: RouterLocation) => {
		const render = routes[path] ?? notFound;
		try {
			outlet.set(render());
		} catch {
			outlet.set(notFound());
		}
	};

	return Fragment(ImplementEffect([location], show), outlet);
}

describe("a router built on the public surface", () => {
	it("renders the current route, follows navigation, and falls back", () => {
		navigateTo("/");
		const { target, render, cleanup } = mount(
			Div(
				{ id: "root" },
				MiniRouter(
					{
						"/": () => P("home"),
						"/about": () => P("about"),
					},
					() => P("not found"),
				),
			),
		);
		const unmount = render();

		expect(target.querySelector("#root")!.textContent).toBe("home");

		navigateTo("/about");
		expect(target.querySelector("#root")!.textContent).toBe("about");

		navigateTo("/nowhere");
		expect(target.querySelector("#root")!.textContent).toBe("not found");

		unmount();
		cleanup();
	});

	it("stops following the location once it unmounts", () => {
		navigateTo("/");
		const { target, render, cleanup } = mount(
			Div(
				{ id: "root" },
				MiniRouter({ "/": () => P("home") }, () => P("not found")),
			),
		);
		const unmount = render();
		expect(target.querySelector("#root")!.textContent).toBe("home");

		unmount();
		navigateTo("/about");
		expect(target.innerHTML).toBe("");

		cleanup();
	});

	it("serializes at the location the server render installed", () => {
		expect(
			renderToString(
				MiniRouter({ "/about": () => P("about") }, () => P("not found")),
				{
					location: "/about",
				},
			).html,
		).toBe("<p>about</p><!---->");
	});
});
