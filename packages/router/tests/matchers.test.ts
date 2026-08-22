// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { App, navigateTo, Span, type Readable } from "@implementjs/core";
import { describe, expect, it } from "vitest";
import { mismatch, Router, type RouteMatcher } from "../src/index";

const integer: RouteMatcher<number> = {
	match: (value) => (/^\d+$/.test(value) ? Number(value) : mismatch),
};

const word: RouteMatcher<string> = {
	match: (value) => (/^[a-z]+$/.test(value) ? value : mismatch),
};

/** Mounts a router at `path` and hands back its text plus a teardown. */
function mount(router: ReturnType<typeof Router>, path: string) {
	navigateTo(path);
	const target = document.createElement("div");
	document.body.appendChild(target);
	const unmount = App({ target }).render(router);
	return {
		text: () => target.textContent,
		dispose: () => {
			unmount();
			target.remove();
		},
	};
}

/** Renders a param with the type it arrived as, which is the thing under test. */
const show = (label: string, value: Readable<unknown>) =>
	Span(`${label} ${String(value.get())} (${typeof value.get()})`);

describe("param matchers", () => {
	const tree = {
		"/posts": {
			"/:id=integer": ({ id }: { id: Readable<unknown> }) => show("post", id),
			"/:slug=word": ({ slug }: { slug: Readable<unknown> }) => show("slug", slug),
			"/:...rest": ({ rest }: { rest: Readable<unknown> }) => show("rest", rest),
		},
	};

	const router = () =>
		Router(tree, { matchers: { integer, word }, fallback: () => Span("not found") });

	it("renders the matched route with the value the matcher produced", () => {
		const view = mount(router(), "/posts/42");
		expect(view.text()).toBe("post 42 (number)");
		view.dispose();
	});

	it("falls through to the next route a matcher accepts", () => {
		const view = mount(router(), "/posts/hello");
		expect(view.text()).toBe("slug hello (string)");
		view.dispose();
	});

	it("falls through to a plain param when every matcher turns the path down", () => {
		const view = mount(router(), "/posts/Hello-42");
		expect(view.text()).toBe("rest Hello-42 (string)");
		view.dispose();
	});

	it("shows the fallback when nothing is left", () => {
		const only = Router(
			{ "/posts/:id=integer": ({ id }: { id: Readable<unknown> }) => show("post", id) },
			{ matchers: { integer }, fallback: (error) => Span(`${error.code}`) },
		);
		const view = mount(only, "/posts/hello");
		expect(view.text()).toBe("404");
		view.dispose();
	});

	it("keeps the matcher out of the href it builds", () => {
		expect(router().href("/posts/:id=integer", { id: 42 })).toBe("/posts/42");
	});

	it("refuses a tree naming a matcher it was not given", () => {
		expect(() => Router({ "/posts/:id=integer": () => Span() })).toThrow(
			/"integer", which is not in the router's matchers/,
		);
	});
});
