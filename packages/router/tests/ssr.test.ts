/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import { Div, P, type Mountable } from "@implementjs/core";
import { renderToString } from "@implementjs/core/server";
import { ROUTED_LINK_ATTRIBUTE, Router } from "../src/index";

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

	it("renders Link as an anchor, marked as one the router follows", () => {
		const router = makeIssuesRouter();
		const routes = Router({
			"/": () => Div(router.Link({ to: "/issues/:id", params: { id: 7 } }, "Open")),
		});
		expect(renderToString(routes, { location: "/" }).html).toBe(
			'<div><a href="/issues/7" data-implement-link>Open</a></div><!---->',
		);
	});

	it("names the marker rather than leaving callers to spell it", () => {
		// what `@implementjs/kit` reads to tell a routed link from a plain `<a>`,
		// which is a full document load and not worth preloading
		expect(ROUTED_LINK_ATTRIBUTE).toBe("data-implement-link");
	});

	it("marks the current Link with aria-current", () => {
		const router = makeIssuesRouter();
		const routes = Router({
			"/about": () => Div(router.Link({ to: "/about" }, "About")),
		});
		expect(renderToString(routes, { location: "/about" }).html).toBe(
			'<div><a href="/about" aria-current="page" data-implement-link>About</a></div><!---->',
		);
	});
});
