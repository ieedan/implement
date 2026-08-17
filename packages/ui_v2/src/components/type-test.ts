import { Br, Div, Img, Input } from "./elements";
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
