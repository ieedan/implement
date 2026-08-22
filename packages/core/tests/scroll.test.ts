// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { App, Div, navigateTo, Router, setNavigationResolver } from "../src/index";

/** happy-dom keeps whatever the last test scrolled to. */
beforeEach(() => {
	window.scrollTo(0, 0);
});

describe("scroll restoration", () => {
	it("takes restoration over from the browser", () => {
		navigateTo("/installed");
		expect(history.scrollRestoration).toBe("manual");
	});

	it("restores the position of each entry on back and forward", () => {
		navigateTo("/list");
		window.scrollTo(0, 500);

		// pushing captures where the list was left, and lands at the top
		navigateTo("/list/1");
		expect(window.scrollY).toBe(0);
		window.scrollTo(0, 120);

		history.back();
		expect(window.location.pathname).toBe("/list");
		expect(window.scrollY).toBe(500);

		history.forward();
		expect(window.location.pathname).toBe("/list/1");
		expect(window.scrollY).toBe(120);
	});

	it("keeps entries apart when the same URL is visited twice", () => {
		navigateTo("/twice");
		window.scrollTo(0, 700);
		navigateTo("/between");
		navigateTo("/twice");
		window.scrollTo(0, 40);
		navigateTo("/after");

		history.back();
		expect(window.scrollY).toBe(40);
		history.back();
		expect(window.scrollY).toBe(0); // /between was never scrolled
		history.back();
		expect(window.scrollY).toBe(700);
	});

	it("scrolls to the top on a push and stays put on a replace", () => {
		navigateTo("/push-a");
		window.scrollTo(0, 300);
		navigateTo("/push-b");
		expect(window.scrollY).toBe(0);

		window.scrollTo(0, 300);
		navigateTo("/replaced", { replace: true });
		expect(window.scrollY).toBe(300);
	});

	it("lets navigateTo opt out of the scroll to the top", () => {
		navigateTo("/opt-a");
		window.scrollTo(0, 250);
		navigateTo("/opt-b", { noScroll: true });
		expect(window.scrollY).toBe(250);

		// a replace never scrolls, so the flag has nothing to skip there
		navigateTo("/opt-c", { replace: true, noScroll: true });
		expect(window.scrollY).toBe(250);
	});

	it("restores a position opted out of on the way in", () => {
		navigateTo("/keep");
		window.scrollTo(0, 360);
		navigateTo("/keep?filter=open", { noScroll: true });
		expect(window.scrollY).toBe(360);

		navigateTo("/elsewhere");
		expect(window.scrollY).toBe(0);
		history.back();
		expect(window.scrollY).toBe(360);
	});
});

describe("scroll restoration through a slow navigation resolver", () => {
	it("records the scroll of the page on screen, not of the one being navigated to", async () => {
		navigateTo("/slow-a");
		window.scrollTo(0, 210);
		navigateTo("/slow-b");
		window.scrollTo(0, 640);
		navigateTo("/slow-c");

		// a resolver that never lets the first back commit before the second
		// one starts, which is what a route-data fetch does on a fast double-tap
		const held: (() => void)[] = [];
		setNavigationResolver(() => new Promise<void>((resolve) => held.push(resolve)));

		history.back(); // → /slow-b, held open
		history.back(); // → /slow-a, held open; /slow-b is still on screen
		for (const release of held) release();
		setNavigationResolver(null);
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.pathname).toBe("/slow-a");
		expect(window.scrollY).toBe(210);

		// the held-open navigation must not have overwritten /slow-b's position
		// with what /slow-c was showing
		history.forward();
		expect(window.location.pathname).toBe("/slow-b");
		expect(window.scrollY).toBe(640);
	});
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
