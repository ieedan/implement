import { A, Br, Button, Div, Form, H1, Img, Input, Link, P, Span } from "./elements";
import { ForEach } from "./helpers/foreach";
import { Fragment } from "./helpers/fragment";
import { If } from "./helpers/if";
import { Implement } from "./helpers/implement";
import { Svg } from "./helpers/svg";
import { derived, Ref, signal, type Readable, type Signal, type Writable } from "../signal";
import type { Child } from "./types";
import type { ComponentProps, ElementProps } from "./props";

const div = new Ref<HTMLDivElement>();
Div({ this: div });

const input = new Ref<HTMLInputElement>();
Input({ this: input });

const anyElement = new Ref<HTMLElement>();
Div({ this: anyElement });

// @ts-expect-error a div ref is not an input
Input({ this: div });

Div({ class: "ok" }, "hello");
Div({ children: "hello" });
Div("hello");
Div(H1("title"), P("body"));
Fragment("hello", Span("x"));
Fragment(H1("title"), P("body"));
Fragment({ children: "hello" });
Fragment({}, "hello");
Fragment(signal("live"));
H1("Welcome!");
Button("Increment");
Button({ type: "button" }, "Save");
Div(signal("live"));

const active = signal(true);
const classSignal = signal<string | undefined>("btn");
Div({ class: undefined });
Div({ class: classSignal });
Div({ class: { active: true, hidden: undefined } });
Div({ class: { active } });
Div({ class: ["btn", { active }, false, ["nested", { on: 1 }]] });
Div({ class: [classSignal, active.bind((a) => a && "active")] });
Div({ class: active.bind((a) => ["btn", { active: a }]) });

Div({ hidden: true });
Div({ hidden: "" });
Div({ hidden: "until-found" });
Div({ hidden: active.bind((open) => (open ? undefined : "")) });
const untilFound = false;
Div({
	hidden: active.bind((open) => (open ? undefined : untilFound ? "until-found" : "")),
});
Button({ disabled: active.bind((a) => !a) });
// @ts-expect-error hidden does not accept arbitrary strings
Div({ hidden: "nope" });

// @ts-expect-error class does not accept functions
Div({ class: () => "nope" });
// @ts-expect-error class array does not accept functions
Div({ class: ["ok", () => "nope"] });

Input({ type: "text" });
Img({ src: "/x.png", alt: "" });
Br();

A({ href: "/", target: "_blank", rel: "noopener", referrerPolicy: "no-referrer" });
A({ href: "/", target: "other-frame", rel: "noopener noreferrer" });
Button({ formMethod: "post", formEnctype: "multipart/form-data", formTarget: "_blank" });
Form({ method: "dialog", enctype: "text/plain", autocomplete: "on" });
Img({ src: "/x.png", alt: "", crossOrigin: "anonymous", referrerPolicy: "origin" });
Input({ capture: "user", autocomplete: "email" });
Link({ rel: "preload", as: "style", crossOrigin: "anonymous" });
Div({ role: "navigation" });

// @ts-expect-error unknown form method
Form({ method: "put" });
// @ts-expect-error unknown referrer policy
A({ referrerPolicy: "nope" });
// @ts-expect-error unknown aria role
Div({ role: "not-a-role" });
// @ts-expect-error unknown input capture
Input({ capture: "front" });

// @ts-expect-error input cannot have children
Input({ type: "text" }, "nope");
// @ts-expect-error input cannot have a children prop
Input({ children: "nope" });
// @ts-expect-error img cannot have children
Img({ src: "/x.png", alt: "" }, "nope");
// @ts-expect-error br cannot have children
Br({}, "nope");

const glyph = signal(`<svg viewBox="0 0 16 16"></svg>`);
Svg(`<svg viewBox="0 0 16 16"></svg>`);
Svg(glyph);
Svg(glyph, {
	width: 20,
	height: "1.5rem",
	viewBox: "0 0 16 16",
	preserveAspectRatio: "xMidYMid meet",
	fill: signal("currentColor"),
	"stroke-width": 1.5,
	class: ["icon", { active }],
	style: { color: "red", "--size": "16px" },
	"aria-hidden": true,
	"data-icon": "check",
	onClick: (ev) => ev.currentTarget.getBBox(),
});

const svgRef = new Ref<SVGSVGElement>();
Svg(glyph, { this: svgRef });

// @ts-expect-error a div ref is not an svg ref
Svg(glyph, { this: div });
// @ts-expect-error svg props are attribute-named: strokeWidth is not a thing
Svg(glyph, { strokeWidth: 1.5 });
// @ts-expect-error svg content is authored in the string, not via children
Svg(glyph, {}, "nope");

const title = signal("Tracker");
Implement.Head(
	Implement.Head.Title(title),
	Implement.Head.Title("Tracker"),
	Implement.Head.Meta({ name: "description", content: title }),
	Implement.Head.Meta({ property: "og:title", content: "Tracker" }),
	Implement.Head.Meta({ charset: "utf-8" }),
	Implement.Head.Link({ rel: "icon", href: "/favicon.svg" }),
	Implement.Head.Script({ src: "/analytics.js", async: true }),
	Implement.Head.Script(
		{ type: "application/ld+json" },
		title.bind((t) => `{"name":"${t}"}`),
	),
	Implement.Head.Style(":root { color-scheme: dark; }"),
);

// @ts-expect-error only head-branded components slot into Implement.Head
Implement.Head(Div());
// @ts-expect-error text is not a head child
Implement.Head("nope");
// @ts-expect-error head components cannot render outside Implement.Head
Div({}, Implement.Head.Meta({ name: "description", content: "nope" }));
// @ts-expect-error head components are not regular children props
Div({ children: Implement.Head.Title("nope") });
// @ts-expect-error meta content cannot be a script prop bag
Implement.Head.Meta({ src: "/nope.js" });
// @ts-expect-error script content is the second argument, not a children prop
Implement.Head.Script({ children: "nope" });

const selected = Implement.Set<string>(["a", "b"]);
selected.add("c");
selected.toggle("a");
selected.delete("b");
const selectedCount: Readable<number> = selected.bind((s) => s.size);
const selectedSize: Readable<number> = selected.bind("size");
Span("selected: ", selectedCount, selectedSize);
Div({ class: { active: selected.bind((s) => s.has("a")) } });
If(selected.bind((s) => s.has("a"))).Then(Span("a is selected"));
ForEach(
	selected.bind((s) => [...s]),
	(item) => item,
	(item) => Span(item),
);
derived([selected], (s) => s.size);

const drafts = Implement.Map<string, string>([["a", "draft"]]);
drafts.set("b", "another");
drafts.delete("a");
const draft: string | undefined = drafts.get("b");
const draftsSnapshot: ReadonlyMap<string, string> = drafts.get();
const draftFor: Readable<string> = drafts.bind((d) => d.get("a") ?? "");
Span(draft, draftsSnapshot.size.toString(), draftFor);
derived([drafts], (d) => d.size);

// @ts-expect-error a reactive set has no writable set(value)
selected.set(new Set(["a"]));
// @ts-expect-error snapshots are read-only
selected.get().add("nope");
// @ts-expect-error snapshots are read-only
drafts.get().set("nope", "nope");
ForEach(
	// @ts-expect-error a reactive set is not a readable list; bind to an array instead
	selected,
	(item: string) => item,
	(item) => Span(item),
);

const todo = signal({
	title: "Ship",
	done: false,
	tags: ["a"] as string[],
	count: 0,
	author: { name: "Ada" },
});
const todoTitle: Signal<string> = todo.bind("title");
const authorName: Signal<string> = todo.bind("author.name");
todo.bind("done").toggle();
todo.bind("tags").push("b");
todo.bind("count").increment();
const flags: Writable<{ done: boolean; tags: string[] }> = signal({ done: false, tags: [] });
flags.bind("done").toggle();
flags.bind("tags").push("x");
const _writableBool: Writable<boolean> = signal(false);
const _writableFromBind: Writable<boolean> = todo.bind("done");
const _signalPassThrough: Signal<number> = signal(signal(0));
const _writablePassThrough: Writable<boolean> = signal(_writableBool);
const _coercedProp: Writable<boolean> = signal(false as boolean | Writable<boolean>);
// @ts-expect-error already-writable values are not wrapped
const _notNested: Signal<Signal<number>> = signal(signal(1));
const doneViaUpdate: Signal<boolean> = todo.bind(
	(t) => t.done,
	(prev, next) => ({ ...prev, done: next }),
);
doneViaUpdate.toggle();
Span(todoTitle, authorName);

const upper = todo.bind((t) => t.title.toUpperCase());
// @ts-expect-error one-way bind is not writable
upper.set("nope");

type _AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

type DivProps = ComponentProps<typeof Div>;
type InputProps = ComponentProps<typeof Input>;
const _divFromFactory: _AssertEqual<DivProps, ElementProps<"div">> = true;
const _divFromTag: _AssertEqual<ComponentProps<"div">, ElementProps<"div">> = true;
const _inputFromFactory: _AssertEqual<InputProps, ElementProps<"input">> = true;

const _divProps: DivProps = { class: "ok", this: div };
const _inputProps: InputProps = { type: "text", this: input };

// @ts-expect-error a div's this is not an input
const _divThisWrong: DivProps = { this: input };
// @ts-expect-error div has no type attribute
const _divNoType: DivProps = { type: "text" };
// @ts-expect-error input cannot have a children prop
const _inputNoChildren: InputProps = { children: "nope" };

type CardProps = ComponentProps<typeof Div> & { title: string };
function Card({ title, ...props }: CardProps, ...children: Child[]) {
	return Div(props, title, ...children);
}
Card({ title: "Hello", class: "card" }, "body");
// @ts-expect-error title is required
Card({ class: "card" });

function Fancy(props: { color: string }, ..._children: Child[]) {
	return Div({ style: { color: props.color } });
}
type FancyProps = ComponentProps<typeof Fancy>;
const _fancy: FancyProps = { color: "red" };
// @ts-expect-error color is required
const _fancyMissing: FancyProps = {};
