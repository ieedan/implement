// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	App,
	Await,
	Button,
	Div,
	ForEach,
	Html,
	If,
	Implement,
	Key,
	Li,
	P,
	Portal,
	signal,
	Span,
	Svg,
	Switch,
	Ul,
	type Child,
} from "../src/index";
import { renderToString } from "../src/server/index";

/**
 * Server-renders `build()`, injects the markup the way the Vite plugin does,
 * and hydrates a second instance of the same tree into it. `build` runs once
 * per side so signals created inside it are independent per render.
 */
function hydrate(build: () => Child | Child[]) {
	const { html } = renderToString(build());
	const target = document.createElement("div");
	target.innerHTML = `<div data-ssr style="display: contents">${html}</div>`;
	document.body.appendChild(target);
	const wrapper = target.firstElementChild as HTMLElement;
	const app = App({ target });
	const children = build();
	const unmount = app.render(...(Array.isArray(children) ? children : [children]));
	return { target, wrapper, unmount };
}

/** Fresh-mounts `build()` and returns the container, the reference structure. */
function fresh(build: () => Child | Child[]) {
	const container = document.createElement("div");
	const children = build();
	App({ target: container }).render(...(Array.isArray(children) ? children : [children]));
	return container;
}

function expectConverged(build: () => Child | Child[]) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const { wrapper, unmount } = hydrate(build);
	expect(warn).not.toHaveBeenCalled();
	expect(wrapper.innerHTML).toBe(fresh(build).innerHTML);
	unmount();
	warn.mockRestore();
}

afterEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
});

describe("hydration", () => {
	it("adopts server elements instead of recreating them", () => {
		const build = () => Div({ id: "root" }, Span("hi"));
		const { html } = renderToString(build());
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const serverSpan = target.querySelector("span")!;

		App({ target }).render(build());

		expect(target.querySelector("span")).toBe(serverSpan);
		expect(serverSpan.isConnected).toBe(true);
		expect(target.querySelector("[data-ssr]")).toBeNull();
	});

	it("attaches working event handlers to claimed nodes", () => {
		const clicks = signal(0);
		const build = () => Button({ onClick: () => clicks.increment() }, "add");
		const { wrapper } = hydrate(build);
		wrapper.querySelector("button")!.click();
		expect(clicks.get()).toBe(1);
	});

	it("keeps signals live on claimed text", () => {
		const make = () => {
			const count = signal(0);
			return { count, tree: Div(Span("count: ", count)) };
		};
		const server = make();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);

		const client = make();
		App({ target }).render(client.tree);
		const span = target.querySelector("span")!;
		expect(span.textContent).toBe("count: 0");
		// the merged server text node was split so each mountable owns its piece
		expect(span.childNodes.length).toBe(2);
		client.count.set(5);
		expect(span.textContent).toBe("count: 5");
	});

	it("converges to the fresh-mount structure", () => {
		const cases: (() => Child | Child[])[] = [
			() => Div(Span("a"), "text", P("b")),
			() => Div(If(true, Span("shown")), "tail"),
			() => Div(If(false, Span("hidden")).Else(P("else")), Span("after")),
			() => Div(If(true, If(true, Span("nested")), P("sibling"))),
			() =>
				Div(
					ForEach(
						["a", "b", "c"],
						(item) => item,
						(item) => Li(item),
					),
				),
			() => Div(Switch(signal("b")).Case("a", P("a")).Case("b", P("b")).Default(P("d"))),
			() => Div(Key(signal(1), Span("keyed"))),
			() => Div(Implement.Boundary(Span("safe")).Catch(() => P("caught"))),
			() => [Div(Span("multi")), P("roots")],
			() => Div(Html("<b>bold</b> raw"), Span("after")),
			() => Div(Svg('<svg viewBox="0 0 4 4"><path d="M0 0"/></svg>'), Span("s")),
			() => Div(If(true, "a", Span("b"), "c")),
		];
		for (const build of cases) expectConverged(build);
	});

	it("keeps reactive helpers working after hydration", () => {
		const make = () => {
			const flag = signal(true);
			const items = signal(["x", "y"]);
			return {
				flag,
				items,
				tree: Div(
					If(flag, Span("on")).Else(Span("off")),
					Ul(
						ForEach(
							items,
							(item) => item,
							(item) => Li(item),
						),
					),
				),
			};
		};
		const server = make();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);

		const client = make();
		App({ target }).render(client.tree);
		const claimedLi = target.querySelector("li")!;

		client.flag.set(false);
		expect(target.querySelector("span")!.textContent).toBe("off");
		client.items.set(["y", "x", "z"]);
		const lis = Array.from(target.querySelectorAll("li")).map((li) => li.textContent);
		expect(lis).toEqual(["y", "x", "z"]);
		// reorder reused the claimed row instance
		expect(target.querySelectorAll("li")[1]).toBe(claimedLi);
	});

	it("hydrates Await's pending branch, then resolves", async () => {
		let resolve!: (value: string) => void;
		const promise = new Promise<string>((r) => {
			resolve = r;
		});
		const build = (source: PromiseLike<string>) =>
			Div(
				Await(source)
					.WhileLoading(P("loading"))
					.Then((value) => Span(value)),
			);
		const { html } = renderToString(build(new Promise<string>(() => {})));
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const serverP = target.querySelector("p")!;

		App({ target }).render(build(promise));
		expect(target.querySelector("p")).toBe(serverP);

		resolve("done");
		await promise;
		await Promise.resolve();
		expect(target.querySelector("p")).toBeNull();
		expect(target.querySelector("span")!.textContent).toBe("done");
	});

	it("recreates Portal content and sweeps the serialized copy", () => {
		const build = () => Div(Span("in place"), Portal(P("floating")));
		const { html } = renderToString(build());
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		// the server render put the portal output at the end of its body
		expect(html).toContain("floating");

		App({ target }).render(build());
		// swept from the wrapper, recreated in document.body
		expect(target.querySelectorAll("p").length).toBe(0);
		expect(document.body.querySelector(":scope > p")!.textContent).toBe("floating");
	});

	it("sweeps server head tags once the client Head mounts", () => {
		const build = () =>
			Div(
				Implement.Head(
					Implement.Head.Title("Page"),
					Implement.Head.Meta({ name: "description", content: "d" }),
				),
				P("body"),
			);
		const { head, html } = renderToString(build());
		document.head.innerHTML = head;
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		expect(document.head.querySelectorAll("[data-ssr]").length).toBe(1);

		App({ target }).render(build());
		expect(document.head.querySelectorAll("[data-ssr]").length).toBe(0);
		expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
		expect(document.title).toBe("Page");
	});

	it("keeps Html blocks reactive after claiming them", () => {
		const make = () => {
			const markup = signal("<b>one</b>");
			return { markup, tree: Div(Html(markup)) };
		};
		const server = make();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const claimed = target.querySelector("b")!;

		const client = make();
		App({ target }).render(client.tree);
		// the initial value was adopted, not re-parsed
		expect(target.querySelector("b")).toBe(claimed);

		client.markup.set("<i>two</i>");
		expect(target.querySelector("b")).toBeNull();
		expect(target.querySelector("i")!.textContent).toBe("two");
	});

	it("keeps Svg props reactive after claiming the element", () => {
		const make = () => {
			const stroke = signal("red");
			return {
				stroke,
				tree: Div(Svg('<svg viewBox="0 0 4 4"><path d="M0 0"/></svg>', { stroke })),
			};
		};
		const server = make();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const claimed = target.querySelector("svg")!;

		const client = make();
		App({ target }).render(client.tree);
		expect(target.querySelector("svg")).toBe(claimed);
		client.stroke.set("blue");
		expect(claimed.getAttribute("stroke")).toBe("blue");
	});

	it("falls back to a fresh mount on a structural mismatch", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const target = document.createElement("div");
		// server markup from a different render than the client produces
		target.innerHTML = `<div data-ssr><p>stale server markup</p></div>`;
		document.body.appendChild(target);

		App({ target }).render(Div(Span("client truth")));

		expect(warn).toHaveBeenCalledOnce();
		expect(target.querySelector("[data-ssr]")).toBeNull();
		expect(target.textContent).toBe("client truth");
		expect(target.innerHTML).toBe(fresh(() => Div(Span("client truth"))).innerHTML);
		warn.mockRestore();
	});

	it("unmounts a hydrated tree cleanly", () => {
		const { wrapper, unmount } = hydrate(() =>
			Div(
				If(true, Span("a")),
				ForEach(
					["x"],
					(item) => item,
					(item) => Li(item),
				),
			),
		);
		unmount();
		expect(wrapper.innerHTML).toBe("");
	});

	it("does not re-claim the wrapper on a second render", () => {
		const { target, wrapper } = hydrate(() => Div(Span("first")));
		const first = wrapper.querySelector("div")!;
		App({ target }).render(P("second"));
		// the second root mounts fresh into the target, leaving the first alone
		expect(wrapper.querySelector("div")).toBe(first);
		expect(target.querySelector(":scope > p")!.textContent).toBe("second");
	});
});
