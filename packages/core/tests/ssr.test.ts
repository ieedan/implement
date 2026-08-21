/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import {
	Await,
	Br,
	Button,
	Div,
	ForEach,
	Fragment,
	Html,
	If,
	Implement,
	Input,
	Li,
	Option,
	P,
	Portal,
	Router,
	Select,
	signal,
	Span,
	Svg,
	Switch,
	Textarea,
	Ul,
	navigateTo,
	type Mountable,
} from "../src/index";
import { renderToString } from "../src/server/index";

describe("elements and props", () => {
	it("serializes a basic tree with attributes", () => {
		const { html } = renderToString(
			Div({ id: "app" }, P("hello"), Span({ "data-kind": "x", "aria-hidden": true }, 42)),
		);
		expect(html).toBe(
			'<div id="app"><p>hello</p><span data-kind="x" aria-hidden="true">42</span></div>',
		);
	});

	it("resolves class arrays and dictionaries", () => {
		const active = signal(true);
		const { html } = renderToString(Div({ class: ["a", { b: active, c: false }] }));
		expect(html).toBe('<div class="a b"></div>');
	});

	it("serializes style objects and strings", () => {
		expect(renderToString(Div({ style: { color: "red", backgroundColor: "blue" } })).html).toBe(
			'<div style="color: red; background-color: blue"></div>',
		);
		expect(renderToString(Div({ style: "color: red;" })).html).toBe(
			'<div style="color: red"></div>',
		);
	});

	it("renders boolean attributes", () => {
		expect(renderToString(Button({ disabled: true }, "go")).html).toBe(
			"<button disabled>go</button>",
		);
		expect(renderToString(Button({ disabled: false }, "go")).html).toBe("<button>go</button>");
	});

	it("renders readable props and text from signals", () => {
		const label = signal("first");
		const { html } = renderToString(P({ title: label }, label));
		expect(html).toBe('<p title="first">first</p>');
	});

	it("escapes text and attribute values", () => {
		const { html } = renderToString(Div({ title: 'a"b&c' }, "<script> & stuff"));
		expect(html).toBe('<div title="a&quot;b&amp;c">&lt;script&gt; &amp; stuff</div>');
	});

	it("serializes void elements without closing tags", () => {
		expect(renderToString(Br()).html).toBe("<br>");
		expect(renderToString(Input({ type: "text", value: "hi" })).html).toBe(
			'<input type="text" value="hi">',
		);
	});

	it("reflects value into serializable form per tag", () => {
		expect(renderToString(Textarea({ value: "hello" })).html).toBe("<textarea>hello</textarea>");
		expect(renderToString(Input({ type: "checkbox", checked: true })).html).toBe(
			'<input type="checkbox" checked>',
		);
		expect(
			renderToString(
				Select({ value: "b" }, Option({ value: "a" }, "A"), Option({ value: "b" }, "B")),
			).html,
		).toBe('<select><option value="a">A</option><option value="b" selected>B</option></select>');
	});
});

describe("helpers", () => {
	it("renders Fragment children without a wrapper", () => {
		expect(renderToString(Div(Fragment(P("a"), Span("b")))).html).toBe(
			"<div><p>a</p><span>b</span></div>",
		);
		expect(renderToString(Div(Fragment({ children: P("a") }, Span("b")))).html).toBe(
			"<div><p>a</p><span>b</span></div>",
		);
		expect(renderToString(Div(Fragment({}, P("a"), Span("b")))).html).toBe(
			"<div><p>a</p><span>b</span></div>",
		);
	});

	it("renders the matching If branch", () => {
		const on = signal(true);
		expect(renderToString(If(on, Span("yes")).Else(Span("no"))).html).toBe(
			"<span>yes</span><!---->",
		);
		expect(renderToString(If(signal(false), Span("yes")).Else(Span("no"))).html).toBe(
			"<span>no</span><!---->",
		);
		expect(
			renderToString(If(signal(false), Span("a")).ElseIf(signal(true), Span("b")).Else(Span("c")))
				.html,
		).toBe("<span>b</span><!---->");
	});

	it("renders ForEach rows", () => {
		const items = signal(["a", "b", "c"]);
		const { html } = renderToString(
			Ul(
				ForEach(
					items,
					(item) => item,
					(item) => Li(item),
				),
			),
		);
		expect(html).toBe("<ul><li>a</li><li>b</li><li>c</li><!----></ul>");
	});

	it("renders the matching Switch case", () => {
		const status = signal<"todo" | "done">("done");
		const { html } = renderToString(
			Switch(status).Case("todo", Span("todo")).Case("done", Span("done")).Default(Span("?")),
		);
		expect(html).toBe("<span>done</span><!---->");
	});

	it("renders the Await pending branch", () => {
		const resolved = Promise.resolve("value");
		const { html } = renderToString(
			Await(resolved)
				.WhileLoading(P("loading"))
				.Then((value) => P(value)),
		);
		expect(html).toBe("<p>loading</p><!---->");
	});

	it("splats trusted Html verbatim", () => {
		const { html } = renderToString(Div(Html("<b>bold</b> & raw")));
		expect(html).toBe("<div><!--html--><b>bold</b> & raw<!--/html--></div>");
	});

	it("renders Svg with props overriding source attributes", () => {
		const { html } = renderToString(
			Svg('<svg viewBox="0 0 16 16" class="base"><path d="M0 0h16"/></svg>', {
				class: "icon",
				"stroke-width": 2,
			}),
		);
		expect(html).toBe(
			'<svg viewBox="0 0 16 16" class="icon" stroke-width="2"><path d="M0 0h16"/></svg>',
		);
	});

	it("collects Implement.Head output separately", () => {
		const { html, head } = renderToString(
			Div(
				Implement.Head(
					Implement.Head.Title("My Page & Co"),
					Implement.Head.Meta({ name: "description", content: "words" }),
					Implement.Head.Style("body { margin: 0; }"),
				),
				P("content"),
			),
		);
		expect(html).toBe("<div><p>content</p></div>");
		expect(head).toBe(
			'<title>My Page &amp; Co</title><meta name="description" content="words" data-ssr><style data-ssr>body { margin: 0; }</style>',
		);
	});

	it("lands Portal output in the server body", () => {
		const { html } = renderToString(Div({ id: "root" }, Portal(P("modal"))));
		expect(html).toBe('<p>modal</p><div id="root"><!----></div>');
	});

	it("no-ops Implement.Window and Implement.Document", () => {
		const { html } = renderToString(
			Div(Implement.Window({ onResize: () => {} }), Implement.Document({ onKeydown: () => {} })),
		);
		expect(html).toBe("<div></div>");
	});
});

const makeIssuesRouter = () =>
	Router(
		{
			"/": () => P("home"),
			"/about": () => P("about"),
			"/issues": {
				layout: (child: Mountable) => Div({ class: "layout" }, child),
				"/": () => P("issues"),
				"/:id": ({ id }) => P(id),
			},
		},
		{ fallback: () => P("not found") },
	);

const makeCatchAllRouter = () =>
	Router(
		{
			"/docs": {
				"/": () => P("docs home"),
				"/guide": () => P("static guide"),
				"/:...slug": ({ slug }) => P(slug),
			},
		},
		{ fallback: () => P("not found") },
	);

const navigateDuringRender: Mountable = () => ({
	mount() {
		navigateTo("/elsewhere");
	},
	unmount() {},
	getFirstDomNode: () => null,
});

describe("router", () => {
	it("renders the route matching the provided location", () => {
		const router = makeIssuesRouter();
		expect(renderToString(router, { location: "/about" }).html).toBe("<p>about</p><!---->");
		expect(renderToString(router, { location: { path: "/" } }).html).toBe("<p>home</p><!---->");
	});

	it("renders layouts and params", () => {
		const router = makeIssuesRouter();
		expect(renderToString(router, { location: "/issues/42" }).html).toBe(
			'<div class="layout"><p>42</p><!----></div><!---->',
		);
	});

	it("renders the fallback for unmatched paths", () => {
		const router = makeIssuesRouter();
		expect(renderToString(router, { location: "/missing" }).html).toBe("<p>not found</p><!---->");
	});

	it("passes a 404 error to the fallback for unmatched paths", () => {
		const router = Router(
			{ "/": () => P("home") },
			{ fallback: (error) => P(`${error.code}: ${error.message}`) },
		);
		expect(renderToString(router, { location: "/missing" }).html).toBe(
			"<p>404: Not Found</p><!---->",
		);
	});

	it("renders the fallback with a 500 error when a route render throws", () => {
		const router = Router(
			{
				"/": () => P("home"),
				"/boom": () => {
					throw new Error("exploded");
				},
			},
			{ fallback: (error) => P(`${error.code}: ${error.message}`) },
		);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(renderToString(router, { location: "/boom" }).html).toBe(
				"<p>500: exploded</p><!---->",
			);
		} finally {
			spy.mockRestore();
		}
	});

	it("passes a thrown { code, message } through to the fallback", () => {
		const router = Router(
			{
				"/secret": () => {
					throw { code: 403, message: "Forbidden" };
				},
			},
			{ fallback: (error) => P(`${error.code}: ${error.message}`) },
		);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(renderToString(router, { location: "/secret" }).html).toBe(
				"<p>403: Forbidden</p><!---->",
			);
		} finally {
			spy.mockRestore();
		}
	});

	it("matches a catch-all across one or more segments", () => {
		const router = makeCatchAllRouter();
		expect(renderToString(router, { location: "/docs/intro" }).html).toBe("<p>intro</p><!---->");
		expect(renderToString(router, { location: "/docs/a/b/c" }).html).toBe("<p>a/b/c</p><!---->");
	});

	it("prefers static segments and exact matches over the catch-all", () => {
		const router = makeCatchAllRouter();
		expect(renderToString(router, { location: "/docs" }).html).toBe("<p>docs home</p><!---->");
		expect(renderToString(router, { location: "/docs/guide" }).html).toBe(
			"<p>static guide</p><!---->",
		);
	});

	it("does not match a catch-all with zero segments", () => {
		const router = Router(
			{ "/docs": { "/:...slug": ({ slug }) => P(slug) } },
			{ fallback: () => P("not found") },
		);
		expect(renderToString(router, { location: "/docs" }).html).toBe("<p>not found</p><!---->");
	});

	it("decodes catch-all segments and builds encoded hrefs", () => {
		const router = makeCatchAllRouter();
		expect(renderToString(router, { location: "/docs/a%20b/c" }).html).toBe("<p>a b/c</p><!---->");
		expect(router.href("/docs/:...slug", { slug: "a b/c" })).toBe("/docs/a%20b/c");
	});

	it("scopes a layout under a (group) key without adding a path segment", () => {
		const router = Router({
			"(app)": {
				layout: (child: Mountable) => Div({ class: "app" }, child),
				"/dashboard": () => P("dash"),
			},
			"/about": () => P("about"),
		});
		expect(renderToString(router, { location: "/dashboard" }).html).toBe(
			'<div class="app"><p>dash</p><!----></div><!---->',
		);
		expect(renderToString(router, { location: "/about" }).html).toBe("<p>about</p><!---->");
	});

	it("drops (group) parts inside multi-segment keys", () => {
		const router = Router({
			"/docs/(legal)/terms": () => P("terms"),
		});
		expect(renderToString(router, { location: "/docs/terms" }).html).toBe("<p>terms</p><!---->");
	});

	it("rejects a catch-all that is not the last segment", () => {
		expect(() => Router({ "/:...rest": { "/deeper": () => P("nope") } } as never)).toThrow(
			/must be the last path segment/,
		);
	});

	it("renders Link as a plain anchor", () => {
		const router = makeIssuesRouter();
		const routes = Router({
			"/": () => Div(router.Link({ to: "/issues/:id", params: { id: 7 } }, "Open")),
		});
		expect(renderToString(routes, { location: "/" }).html).toBe(
			'<div><a href="/issues/7">Open</a></div><!---->',
		);
	});

	it("marks the current Link with aria-current", () => {
		const router = makeIssuesRouter();
		const routes = Router({
			"/about": () => Div(router.Link({ to: "/about" }, "About")),
		});
		expect(renderToString(routes, { location: "/about" }).html).toBe(
			'<div><a href="/about" aria-current="page">About</a></div><!---->',
		);
	});

	it("throws a clear error for navigateTo during a server render", () => {
		expect(() => renderToString(navigateDuringRender)).toThrow(/server rendering/);
		// the environment is restored even after a throw
		expect(renderToString(P("after")).html).toBe("<p>after</p>");
	});
});

describe("teardown", () => {
	it("removes every signal subscription created during the render", () => {
		const count = signal(0);
		let active = 0;
		const original = count.subscribe.bind(count);
		count.subscribe = (callback) => {
			active++;
			const unsubscribe = original(callback);
			let done = false;
			return () => {
				if (!done) {
					done = true;
					active--;
				}
				unsubscribe();
			};
		};

		const { html } = renderToString(
			Div(
				P(count),
				If(
					count.bind((value) => value > 0),
					Span("pos"),
				).Else(Span("zero")),
				ForEach(
					count.bind((value) => [value]),
					(item) => item,
					(item) => Li(item),
				),
			),
		);
		expect(html).toBe("<div><p>0</p><span>zero</span><!----><li>0</li><!----></div>");
		expect(active).toBe(0);
	});
});
