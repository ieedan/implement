// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
	App,
	context,
	derived,
	Div,
	Dynamic,
	ImplementBoundary,
	ImplementLifecycle,
	P,
	signal,
	Span,
	type Child,
	type Mountable,
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

const Boom = (): Mountable => () => ({
	mount() {
		throw new Error("kaboom");
	},
	unmount() {},
	getFirstDomNode: () => null,
});

/** A `P` that records every mount, since `onMount` only runs a microtask later. */
function Counted(mounts: string[], label: string): Mountable {
	const inner = P(label);
	return () => {
		const node = inner();
		return {
			mount(parent: HTMLElement) {
				mounts.push(label);
				node.mount(parent);
			},
			unmount: () => node.unmount(),
			getFirstDomNode: () => node.getFirstDomNode(),
		};
	};
}

describe("Dynamic", () => {
	it("mounts the node its source holds, and swaps it when that changes", () => {
		const view = signal<Mountable>(P("first"));
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(view)));
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe("<p>first</p><!---->");

		view.set(P("second"));
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>second</p><!---->");

		unmount();
		cleanup();
	});

	it("takes signals and a getter", () => {
		const priority = signal<"high" | "low">("high");
		const icons = {
			high: () => Span({ class: "high" }, "H"),
			low: () => Span({ class: "low" }, "L"),
		};
		const { target, render, cleanup } = mount(
			Div(
				{ id: "root" },
				Dynamic([priority], (p) => icons[p]()),
			),
		);
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe('<span class="high">H</span><!---->');

		priority.set("low");
		expect(target.querySelector("#root")!.innerHTML).toBe('<span class="low">L</span><!---->');

		unmount();
		cleanup();
	});

	it("follows a derived of a mountable", () => {
		const priority = signal<"high" | "low">("high");
		const icon = derived([priority], (p) => Span(p));
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(icon)));
		const unmount = render();

		expect(target.querySelector("#root")!.textContent).toBe("high");

		priority.set("low");
		expect(target.querySelector("#root")!.textContent).toBe("low");

		unmount();
		cleanup();
	});

	it("unmounts the previous node before the next one mounts", () => {
		const torn: string[] = [];
		const Tracked = (name: string) =>
			ImplementLifecycle({ onUnmount: () => torn.push(name) }, P(name));

		const view = signal<Mountable | null>(Tracked("a"));
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(view)));
		const unmount = render();

		view.set(Tracked("b"));
		expect(torn).toEqual(["a"]);
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>b</p><!---->");

		unmount();
		expect(torn).toEqual(["a", "b"]);
		cleanup();
	});

	it("renders nothing for null, and picks up again after it", () => {
		const view = signal<Mountable | null>(null);
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(view)));
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe("<!---->");

		view.set(P("back"));
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>back</p><!---->");

		view.set(null);
		expect(target.querySelector("#root")!.innerHTML).toBe("<!---->");

		unmount();
		cleanup();
	});

	it("leaves what is mounted alone when the value does not change", () => {
		const mounts: string[] = [];
		const stable = Counted(mounts, "stable");
		const a = signal(1);
		const b = signal(1);
		const { render, cleanup } = mount(Div(Dynamic([a, b], () => stable)));
		const unmount = render();

		expect(mounts).toEqual(["stable"]);

		// both sources fire, the getter returns the same node, nothing remounts
		a.set(2);
		b.set(2);
		expect(mounts).toEqual(["stable"]);

		unmount();
		cleanup();
	});

	it("renders a non-mountable child the way anywhere else would", () => {
		const value = signal<Child>("text");
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(value)));
		const unmount = render();

		expect(target.querySelector("#root")!.innerHTML).toBe("text<!---->");

		value.set(P("node"));
		expect(target.querySelector("#root")!.innerHTML).toBe("<p>node</p><!---->");

		unmount();
		cleanup();
	});

	it("keeps its node in place among its siblings", () => {
		const view = signal<Mountable>(P("middle"));
		const { target, render, cleanup } = mount(
			Div({ id: "root" }, Span("before"), Dynamic(view), Span("after")),
		);
		const unmount = render();

		view.set(P("swapped"));
		expect(target.querySelector("#root")!.innerHTML).toBe(
			"<span>before</span><p>swapped</p><!----><span>after</span>",
		);

		unmount();
		cleanup();
	});

	it("propagates context into what it mounts", () => {
		const view = signal<Mountable>(Theme.Use((theme) => Span(theme)));
		const { target, render, cleanup } = mount(
			Theme.Provide("dark").To(Div({ id: "root" }, Dynamic(view))),
		);
		const unmount = render();

		expect(target.querySelector("#root")!.textContent).toBe("dark");

		unmount();
		cleanup();
	});

	it("routes an error thrown by a later swap to the boundary above it", async () => {
		const view = signal<Mountable>(P("fine"));
		const { target, render, cleanup } = mount(
			ImplementBoundary(Div({ id: "root" }, Dynamic(view))).Catch((error) => Span(error.message)),
		);
		const unmount = render();

		view.set(Boom());
		// the boundary swaps in its branch a microtask later
		await Promise.resolve();
		expect(target.textContent).toBe("kaboom");

		unmount();
		cleanup();
	});

	it("releases what it mounted when an ancestor takes the subtree out", () => {
		const torn: string[] = [];
		const view = signal<Mountable>(
			ImplementLifecycle({ onUnmount: () => torn.push("child") }, P("x")),
		);
		const { target, render, cleanup } = mount(Div({ id: "root" }, Dynamic(view)));
		const unmount = render();

		unmount();
		expect(torn).toEqual(["child"]);
		expect(target.innerHTML).toBe("");

		cleanup();
	});

	it("stops following its source once unmounted", () => {
		const mounts: string[] = [];
		const view = signal<Mountable>(P("a"));
		const { render, cleanup } = mount(Div(Dynamic(view)));
		const unmount = render();

		unmount();
		view.set(Counted(mounts, "late"));
		expect(mounts).toEqual([]);

		cleanup();
	});

	it("serializes in a server render", () => {
		const priority = signal<"high" | "low">("low");
		expect(renderToString(Div(Dynamic([priority], (p) => Span(p)))).html).toBe(
			"<div><span>low</span><!----></div>",
		);
	});

	it("serializes an empty region", () => {
		expect(renderToString(Div(Dynamic(signal<Mountable | null>(null)))).html).toBe(
			"<div><!----></div>",
		);
	});
});
