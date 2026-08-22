// @vitest-environment happy-dom
import { expect, it } from "vitest";

/**
 * A reload is the one navigation the router never sees, so the position of the
 * entry the document loads on comes back out of `sessionStorage`. Loading the
 * router only after the storage is seeded is what makes this a fresh document
 * as far as the module is concerned.
 */
it("restores the position of the entry the document loaded on", async () => {
	history.replaceState({ "implement:scroll": 7 }, "", "/reloaded");
	sessionStorage.setItem(
		"implement:scroll-positions",
		JSON.stringify({ next: 8, entries: [[7, { x: 0, y: 420 }]] }),
	);
	window.scrollTo(0, 0);

	const { App, Div, Router } = await import("../src/index");
	const target = document.createElement("div");
	document.body.appendChild(target);

	const router = Router({ "/reloaded": () => Div("reloaded") });
	const unmount = App({ target }).render(router);

	expect(target.textContent).toBe("reloaded");
	expect(window.scrollY).toBe(420);

	unmount();
	target.remove();
});
