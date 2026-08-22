/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back the element tree the mapper just built requires intentional narrowing. */
import { Svg } from "@implementjs/core";
import { Div, emojiCode, ImageResponse, Span, toSatoriElement } from "../src/og.ts";
import { describe, expect, it } from "vitest";

/** The shape satori reads, as much of it as the assertions here look at. */
type Element = { type: string; props: Record<string, unknown> };

/**
 * `props` is `Record<string, unknown>`, so a child has to be described before
 * it can be asserted on. One helper rather than a cast at each call site.
 */
function child(element: Element, index?: number): Element {
	const children = element.props["children"];
	return (index === undefined ? children : (children as Element[])[index]) as Element;
}

describe("toSatoriElement", () => {
	it("maps an element to satori's { type, props } shape", () => {
		const element = toSatoriElement(Div({ style: { display: "flex" } }, "hello"));
		expect(element).toEqual({
			type: "div",
			props: { style: { display: "flex" }, children: "hello" },
		});
	});

	it("appends px to bare numbers, leaving unitless properties alone", () => {
		// core stringifies a style value before og ever sees it, so both of these
		// arrive as digits and only one of them means px
		const element = toSatoriElement(
			Div({ style: { fontSize: 64, lineHeight: 1.2, padding: "2rem", flexGrow: 1 } }),
		);
		expect(element.props["style"]).toEqual({
			fontSize: "64px",
			lineHeight: "1.2",
			padding: "2rem",
			flexGrow: "1",
		});
	});

	it("keeps custom properties verbatim", () => {
		const element = toSatoriElement(Div({ style: { "--brand": "12" } }));
		expect(element.props["style"]).toEqual({ "--brand": "12" });
	});

	it("keeps the attributes core types, `data-*` template keys included", () => {
		// the props type Omits `style` off core's, which is where a mapped type
		// would quietly drop the `data-${string}` and `aria-${string}` keys
		const element = toSatoriElement(Div({ "data-kind": "card", "aria-hidden": true, id: "x" }));
		expect(element.props["data-kind"]).toBe("card");
		expect(element.props["aria-hidden"]).toBe("true");
		expect(element.props["id"]).toBe("x");
	});

	it("passes tw through as a prop", () => {
		const element = toSatoriElement(Div({ tw: "flex text-3xl" }, "hi"));
		expect(element.props["tw"]).toBe("flex text-3xl");
	});

	it("wraps multiple roots in one flex container", () => {
		const element = toSatoriElement([Span("a"), Span("b")]);
		expect(element.type).toBe("div");
		expect(element.props["style"]).toEqual({ display: "flex", width: "100%", height: "100%" });
		expect([child(element, 0).type, child(element, 1).type]).toEqual(["span", "span"]);
	});

	it("parses the raw markup an Svg carries into nodes", () => {
		// every lucide icon is Svg(source): the root is a real element, its
		// content is raw markup nobody parsed until now
		const element = toSatoriElement(
			Svg('<svg viewBox="0 0 24 24" stroke-width="2"><path d="M5 12h14" /></svg>'),
		);
		expect(element.type).toBe("svg");
		expect(element.props["viewBox"]).toBe("0 0 24 24");
		expect(element.props["stroke-width"]).toBe("2");
		expect(child(element)).toEqual({ type: "path", props: { d: "M5 12h14" } });
	});

	it("parses a style attribute inside raw markup", () => {
		const element = toSatoriElement(Svg('<svg><rect style="fill: red; stroke-width: 4" /></svg>'));
		expect(child(element).props["style"]).toEqual({ fill: "red", strokeWidth: "4" });
	});

	it("renders signals at their initial value, like the string render", () => {
		const element = toSatoriElement(Span({ style: { color: "#fff" } }, "Docs"));
		expect(element.props["children"]).toBe("Docs");
	});
});

describe("emojiCode", () => {
	it("drops the presentation selector from an unjoined sequence", () => {
		expect(emojiCode("❤️")).toBe("2764");
	});

	it("keeps every code point of a joined sequence", () => {
		expect(emojiCode("👨‍👩‍👧")).toBe("1f468-200d-1f469-200d-1f467");
	});

	it("hyphenates a flag's two regional indicators", () => {
		expect(emojiCode("🇺🇸")).toBe("1f1fa-1f1f8");
	});
});

const card = () =>
	Div(
		{ style: { display: "flex", width: "100%", height: "100%", background: "#0b0b0e" } },
		Span({ style: { fontSize: 64, color: "#ffffff" } }, "implement"),
	);

describe("ImageResponse", () => {
	it("is a Response with png headers before anything renders", () => {
		const response = new ImageResponse(card());
		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toBe(
			"public, immutable, no-transform, max-age=31536000",
		);
	});

	it("renders a png with the requested dimensions", async () => {
		const response = new ImageResponse(card(), { width: 800, height: 400 });
		const png = new Uint8Array(await response.arrayBuffer());
		// png signature, then IHDR's big-endian width and height
		expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		const header = new DataView(png.buffer, png.byteOffset);
		expect(header.getUint32(16)).toBe(800);
		expect(header.getUint32(20)).toBe(400);
	});

	it("renders svg when asked, for debugging", async () => {
		const response = new ImageResponse(card(), { format: "svg", width: 400, height: 200 });
		expect(response.headers.get("content-type")).toBe("image/svg+xml");
		const svg = await response.text();
		expect(svg.startsWith("<svg")).toBe(true);
		expect(svg).toContain('width="400"');
	});

	it("lets a caller override status and headers", async () => {
		const response = new ImageResponse(card(), {
			status: 201,
			headers: { "cache-control": "max-age=60", "x-og": "1" },
		});
		expect(response.status).toBe(201);
		expect(response.headers.get("cache-control")).toBe("max-age=60");
		expect(response.headers.get("x-og")).toBe("1");
	});

	it("fails the body, not the constructor, when the layout is invalid", async () => {
		// satori refuses to guess a display for an element with several children
		const response = new ImageResponse(Div(Span("a"), Span("b")));
		await expect(response.arrayBuffer()).rejects.toThrow();
	});
});
