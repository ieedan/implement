import { A, Br, Button, Div, Form, H1, Img, Input, Link, P } from "./elements";
import { Implement } from "./helpers/implement";
import { Svg } from "./helpers/svg";
import { Ref, signal } from "../signal";

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
