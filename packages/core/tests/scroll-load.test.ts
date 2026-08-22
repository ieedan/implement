// @vitest-environment happy-dom
import { expect, it } from "vitest";

/**
 * A reload is the one navigation a router never sees, so the position of the
 * entry the document loads on comes back out of `sessionStorage`. Core runs
 * that restore itself off the first location subscription — no router needed,
 * and nothing for a hand-written one to remember. Loading the module only
 * after the storage is seeded is what makes this a fresh document as far as it
 * is concerned.
 */
it("restores the position of the entry the document loaded on", async () => {
	history.replaceState({ "implement:scroll": 7 }, "", "/reloaded");
	sessionStorage.setItem(
		"implement:scroll-positions",
		JSON.stringify({ next: 8, entries: [[7, { x: 0, y: 420 }]] }),
	);
	window.scrollTo(0, 0);

	const { App, Div, ImplementEffect, location } = await import("../src/index");
	const target = document.createElement("div");
	document.body.appendChild(target);

	// what a router is, as far as the restore is concerned: something following
	// the location, and content that gives the page its height
	const unmount = App({ target }).render(
		ImplementEffect([location], () => {}),
		Div("reloaded"),
	);

	expect(target.textContent).toBe("reloaded");
	// the restore waits a microtask so the render it belongs behind has run
	await Promise.resolve();
	expect(window.scrollY).toBe(420);

	unmount();
	target.remove();
});
