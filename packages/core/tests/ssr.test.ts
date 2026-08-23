/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it } from "vitest";
import {
	Await,
	Br,
	Button,
	Div,
	ForEach,
	Fragment,
	Html,
	If,
	ImplementDocument,
	ImplementHead,
	ImplementWindow,
	Input,
	Li,
	navigateTo,
	Option,
	P,
	Portal,
	Select,
	signal,
	Span,
	Svg,
	Switch,
	Textarea,
	Ul,
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

	it("collects ImplementHead output separately", () => {
		const { html, head } = renderToString(
			Div(
				ImplementHead(
					ImplementHead.Title("My Page & Co"),
					ImplementHead.Meta({ name: "description", content: "words" }),
					ImplementHead.Style("body { margin: 0; }"),
				),
				P("content"),
			),
		);
		expect(html).toBe("<div><p>content</p></div>");
		expect(head).toBe(
			'<title>My Page &amp; Co</title><meta name="description" content="words" data-ssr><style data-ssr>body { margin: 0; }</style>',
		);
	});

	it("lands Portal output after the app tree, not inside it", () => {
		const { html } = renderToString(Div({ id: "root" }, Portal(P("modal"))));
		expect(html).toBe('<div id="root"><!----></div><p>modal</p>');
	});

	it("keeps Portal output after the app tree when the portal mounts first", () => {
		const { html } = renderToString([Portal(P("modal")), Div({ id: "root" }, "content")]);
		expect(html).toBe('<!----><div id="root">content</div><p>modal</p>');
	});

	it("no-ops ImplementWindow and ImplementDocument", () => {
		const { html } = renderToString(
			Div(ImplementWindow({ onResize: () => {} }), ImplementDocument({ onKeydown: () => {} })),
		);
		expect(html).toBe("<div></div>");
	});
});

const navigateDuringRender: Mountable = () => ({
	mount() {
		navigateTo("/elsewhere");
	},
	unmount() {},
	getFirstDomNode: () => null,
});

describe("location", () => {
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
