// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { Div, navigateTo, signal } from "@implementjs/core";
import { Router } from "../src/index";

/** happy-dom keeps whatever the last test scrolled to. */
beforeEach(() => {
	window.scrollTo(0, 0);
});

const routes = {
	"/": () => Div("home"),
	"/issues": {
		"/": () => Div("issues"),
		"/:id": () => Div("issue"),
	},
	"/docs/:...slug": () => Div("docs"),
};

describe("href and navigate params", () => {
	it("builds the same href from either shape", () => {
		const router = Router(routes);
		expect(router.href("/issues/:id", { id: 42 })).toBe("/issues/42");
		expect(router.href("/issues/:id", { params: { id: 42 } })).toBe("/issues/42");
	});

	it("reads a signal param at call time", () => {
		const router = Router(routes);
		const id = signal(1);
		expect(router.href("/issues/:id", { id })).toBe("/issues/1");
		id.set(2);
		expect(router.href("/issues/:id", { params: { id } })).toBe("/issues/2");
	});

	it("reads a signal filling a catch-all", () => {
		const router = Router(routes);
		const slug = signal("guide/install");
		expect(router.href("/docs/:...slug", { params: { slug } })).toBe("/docs/guide/install");
	});

	it("navigates with either shape", () => {
		navigateTo("/");
		const router = Router(routes);
		router.navigate("/issues/:id", { id: 7 });
		expect(window.location.pathname).toBe("/issues/7");
		router.navigate("/issues/:id", { params: { id: signal(8) } });
		expect(window.location.pathname).toBe("/issues/8");
	});

	it("carries the navigation options in either shape", () => {
		navigateTo("/issues/1");
		const router = Router(routes);
		window.scrollTo(0, 300);
		router.navigate("/issues/:id", { params: { id: 2 }, noScroll: true });
		expect(window.location.pathname).toBe("/issues/2");
		expect(window.scrollY).toBe(300);
		router.navigate("/issues/:id", { id: 3 }, { noScroll: true });
		expect(window.location.pathname).toBe("/issues/3");
		expect(window.scrollY).toBe(300);
		router.navigate("/issues/:id", { id: 4 });
		expect(window.scrollY).toBe(0);
	});

	it("takes the params object a Link was given", () => {
		navigateTo("/");
		const router = Router(routes);
		const params = { id: signal(11) };
		router.Link({ to: "/issues/:id", params }, "Open");
		router.navigate("/issues/:id", { params });
		expect(window.location.pathname).toBe("/issues/11");
	});

	it("tells a route param named `params` from the options around it", () => {
		const router = Router({ "/search/:params": () => Div("search") });
		expect(router.href("/search/:params", { params: "a=1" })).toBe("/search/a%3D1");
		expect(router.href("/search/:params", { params: { params: "a=1" } })).toBe("/search/a%3D1");
		expect(router.href("/search/:params", { params: signal("a=1") })).toBe("/search/a%3D1");
	});
});
