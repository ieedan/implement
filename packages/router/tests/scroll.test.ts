// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { App, Div, navigateTo } from "@implementjs/core";
import { Router } from "../src/index";

/** happy-dom keeps whatever the last test scrolled to. */
beforeEach(() => {
	window.scrollTo(0, 0);
});

const mount = () => {
	const target = document.createElement("div");
	document.body.appendChild(target);
	return { target, app: App({ target }) };
};

describe("Link and navigate scroll options", () => {
	const routes = {
		"/link-a": () => Div("a"),
		"/link-b": () => Div("b"),
	};

	it("scrolls to the top by default and honors noScroll", () => {
		navigateTo("/link-a");
		const router = Router(routes);
		const { target, app } = mount();
		const unmount = app.render(
			Div(
				router.Link({ to: "/link-b", id: "plain" }, "b"),
				router.Link({ to: "/link-b", id: "quiet", noScroll: true }, "b"),
			),
		);

		window.scrollTo(0, 400);
		target.querySelector<HTMLAnchorElement>("#plain")!.click();
		expect(window.location.pathname).toBe("/link-b");
		expect(window.scrollY).toBe(0);

		navigateTo("/link-a");
		window.scrollTo(0, 400);
		target.querySelector<HTMLAnchorElement>("#quiet")!.click();
		expect(window.location.pathname).toBe("/link-b");
		expect(window.scrollY).toBe(400);

		unmount();
		target.remove();
	});

	it("passes noScroll through router.navigate", () => {
		navigateTo("/link-a");
		const router = Router(routes);
		window.scrollTo(0, 220);
		router.navigate("/link-b", { noScroll: true });
		expect(window.scrollY).toBe(220);
		router.navigate("/link-a");
		expect(window.scrollY).toBe(0);
	});
});
