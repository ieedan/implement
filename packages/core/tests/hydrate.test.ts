// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	App,
	Await,
	Button,
	Div,
	Dynamic,
	ForEach,
	Html,
	If,
	ImplementBoundary,
	ImplementHead,
	Key,
	Li,
	Main,
	P,
	Portal,
	signal,
	Span,
	Svg,
	Switch,
	Ul,
	type Child,
	type Mountable,
} from "../src/index";
import { installHydration } from "../src/hydrate";
import { renderToString } from "../src/server/index";

// Hydration is opt-in: an app that never server-renders should not carry the
// claim machinery. Kit's generated client entry installs it; these tests are
// the client entry.
installHydration();

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

const buildRootDiv = () => Div({ id: "root" }, Span("hi"));

const makeCountTree = () => {
	const count = signal(0);
	return { count, tree: Div(Span("count: ", count)) };
};

const makeReactiveHelpersTree = () => {
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

const buildAwaitTree = (source: PromiseLike<string>) =>
	Div(
		Await(source)
			.WhileLoading(P("loading"))
			.Then((value) => Span(value)),
	);

const buildPortalTree = () => Div(Span("in place"), Portal(P("floating")));

// the portal mounts before the rest of the tree, the arrangement a Toaster in
// a root layout produces
const buildPortalFirstTree = () => [Portal(P("floating")), Main(Span("in place"))];

const buildHeadTree = () =>
	Div(
		ImplementHead(
			ImplementHead.Title("Page"),
			ImplementHead.Meta({ name: "description", content: "d" }),
		),
		P("body"),
	);

const makeHtmlTree = () => {
	const markup = signal("<b>one</b>");
	return { markup, tree: Div(Html(markup)) };
};

const makeSvgTree = () => {
	const stroke = signal("red");
	return {
		stroke,
		tree: Div(Svg('<svg viewBox="0 0 4 4"><path d="M0 0"/></svg>', { stroke })),
	};
};

const makeSvgInIfTree = () => {
	const source = signal('<svg id="one"/>');
	return { source, tree: Button(If(true, Svg(source)), "label") };
};

function throwBoom(): never {
	throw new Error("boom");
}

afterEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
});

describe("hydration", () => {
	it("adopts server elements instead of recreating them", () => {
		const { html } = renderToString(buildRootDiv());
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const serverSpan = target.querySelector("span")!;

		App({ target }).render(buildRootDiv());

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
		const server = makeCountTree();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);

		const client = makeCountTree();
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
			() => Div(Dynamic(signal<Mountable>(Span("dynamic"))), Span("after")),
			() =>
				Div(
					Dynamic([signal("b")], (v) => P(v)),
					"tail",
				),
			() => Div(Dynamic(signal<Mountable | null>(null)), Span("empty")),
			() => Div(ImplementBoundary(Span("safe")).Catch(() => P("caught"))),
			() => [Div(Span("multi")), P("roots")],
			() => Div(Html("<b>bold</b> raw"), Span("after")),
			() => Div(Svg('<svg viewBox="0 0 4 4"><path d="M0 0"/></svg>'), Span("s")),
			// an Svg a helper's sync pass repositions: the icon-in-a-button shape
			() => Button(If(true, Svg('<svg viewBox="0 0 4 4"><path d="M0 0"/></svg>')), "label"),
			() => Div(If(true, "a", Span("b"), "c")),
			// children that own more than the one node a region can move: the rows
			// have to come out inside the branch, ahead of its end marker
			() =>
				Div(
					If(false, Span("hidden")).Else(
						Button("trigger"),
						ForEach(
							["a", "b", "c"],
							(item) => item,
							(item) => Span(item),
						),
					),
					Span("after"),
				),
			() =>
				Ul(
					Switch(signal("list"))
						.Case(
							"list",
							ForEach(
								["a", "b"],
								(item) => item,
								(item) => Li(item),
							),
						)
						.Default(Li("empty")),
				),
			() => Div(If(true, Html("<b>bold</b> raw"), Span("sibling")), Span("after")),
		];
		for (const build of cases) expectConverged(build);
	});

	it("keeps reactive helpers working after hydration", () => {
		const server = makeReactiveHelpersTree();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);

		const client = makeReactiveHelpersTree();
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
		const { html } = renderToString(buildAwaitTree(new Promise<string>(() => {})));
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const serverP = target.querySelector("p")!;

		App({ target }).render(buildAwaitTree(promise));
		expect(target.querySelector("p")).toBe(serverP);

		resolve("done");
		await promise;
		await Promise.resolve();
		expect(target.querySelector("p")).toBeNull();
		expect(target.querySelector("span")!.textContent).toBe("done");
	});

	it("recreates Portal content and sweeps the serialized copy", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { html } = renderToString(buildPortalTree());
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		// the server render put the portal output at the end of its body
		expect(html).toContain("floating");
		const claimed = target.querySelector("span")!;

		App({ target }).render(buildPortalTree());
		// swept from the wrapper, recreated in document.body
		expect(target.querySelectorAll("p").length).toBe(0);
		expect(document.body.querySelector(":scope > p")!.textContent).toBe("floating");
		// and the rest of the tree was hydrated rather than remounted
		expect(target.querySelector("span")).toBe(claimed);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("hydrates the tree when a Portal mounts ahead of it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { html } = renderToString(buildPortalFirstTree());
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const claimed = target.querySelector("main")!;

		App({ target }).render(...buildPortalFirstTree());
		expect(target.querySelector("main")).toBe(claimed);
		expect(target.querySelectorAll("p").length).toBe(0);
		expect(document.body.querySelector(":scope > p")!.textContent).toBe("floating");
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("sweeps server head tags once the client Head mounts", () => {
		const { head, html } = renderToString(buildHeadTree());
		document.head.innerHTML = head;
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		expect(document.head.querySelectorAll("[data-ssr]").length).toBe(1);

		App({ target }).render(buildHeadTree());
		expect(document.head.querySelectorAll("[data-ssr]").length).toBe(0);
		expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
		expect(document.title).toBe("Page");
	});

	it("keeps Html blocks reactive after claiming them", () => {
		const server = makeHtmlTree();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const claimed = target.querySelector("b")!;

		const client = makeHtmlTree();
		App({ target }).render(client.tree);
		// the initial value was adopted, not re-parsed
		expect(target.querySelector("b")).toBe(claimed);

		client.markup.set("<i>two</i>");
		expect(target.querySelector("b")).toBeNull();
		expect(target.querySelector("i")!.textContent).toBe("two");
	});

	it("swaps a reactive Svg in place inside a helper's region", () => {
		const server = makeSvgInIfTree();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);

		const client = makeSvgInIfTree();
		App({ target }).render(client.tree);
		client.source.set('<svg id="two"/>');

		const reference = makeSvgInIfTree();
		reference.source.set('<svg id="two"/>');
		expect(target.querySelector("button")!.innerHTML).toBe(
			fresh(() => reference.tree).querySelector("button")!.innerHTML,
		);
	});

	it("keeps Svg props reactive after claiming the element", () => {
		const server = makeSvgTree();
		const { html } = renderToString(server.tree);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr>${html}</div>`;
		document.body.appendChild(target);
		const claimed = target.querySelector("svg")!;

		const client = makeSvgTree();
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

/**
 * Vite disposes an entry module before it imports the replacement, so an app
 * that tore its tree down in `dispose` left the document blank for the whole
 * import — and blank for good when the replacement threw. Given the hot data
 * Vite passes dispose handlers, `unmount` hands the tree over instead.
 */
describe("hmr handoff", () => {
	/** Stands in for the `data` object Vite passes its dispose handlers. */
	const hotData = {};

	it("keeps the tree mounted until the replacement renders", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const first = App({ target });
		first.render(Div(Span("first")));

		first.unmount(hotData);
		expect(target.textContent).toBe("first");

		App({ target }).render(Div(Span("second")));
		expect(target.textContent).toBe("second");
		expect(target.querySelectorAll("div")).toHaveLength(1);
	});

	it("unmounts immediately when called with no argument", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		app.render(Div(Span("only")));

		app.unmount();
		expect(target.innerHTML).toBe("");
	});

	it("leaves the handed-over tree up when the replacement fails to mount", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const first = App({ target });
		first.render(Div(Span("first")));
		first.unmount(hotData);

		expect(() => App({ target }).render(Div(Span("half")), throwBoom)).toThrow("boom");

		// the half-built replacement is rolled back, not left alongside
		expect(target.textContent).toBe("first");
		expect(target.querySelectorAll("div")).toHaveLength(1);
	});

	it("chains handoffs so a failed replacement cannot strand the tree", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const first = App({ target });
		first.render(Div(Span("first")));
		first.unmount(hotData);

		// a replacement that never mounted is disposed too
		const failed = App({ target });
		failed.unmount(hotData);
		expect(target.textContent).toBe("first");

		App({ target }).render(Div(Span("third")));
		expect(target.textContent).toBe("third");
		expect(target.querySelectorAll("div")).toHaveLength(1);
	});

	it("takes the server-rendered wrapper down with the tree it adopted", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { target, unmount } = hydrate(() => Div(Span("ssr")));
		expect(warn).not.toHaveBeenCalled();

		unmount();
		expect(target.innerHTML).toBe("");
		warn.mockRestore();
	});
});
