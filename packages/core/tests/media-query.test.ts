// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, Div, If, mediaQuery, Span } from "../src/index";
import { installHydration } from "../src/hydrate";
import { renderToString } from "../src/server/index";

// Hydration is opt-in, and these tests stand in for the client entry that opts in.
installHydration();

/** Flush the microtask the readable catches up on after hydration. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

type FakeQuery = {
	matches: boolean;
	/** Move the viewport across the query's boundary and notify listeners. */
	set(matches: boolean): void;
	listeners: number;
};

/**
 * Stands in for `matchMedia` so the viewport is controllable, and so the test
 * can see whether a listener is actually attached.
 */
function stubMatchMedia(initial: boolean): FakeQuery {
	const callbacks = new Set<() => void>();
	const state: FakeQuery = {
		matches: initial,
		listeners: 0,
		set(matches: boolean) {
			state.matches = matches;
			for (const callback of callbacks) callback();
		},
	};
	vi.stubGlobal("matchMedia", (query: string) => ({
		media: query,
		get matches() {
			return state.matches;
		},
		addEventListener: (_: string, callback: () => void) => {
			callbacks.add(callback);
			state.listeners = callbacks.size;
		},
		removeEventListener: (_: string, callback: () => void) => {
			callbacks.delete(callback);
			state.listeners = callbacks.size;
		},
	}));
	return state;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("mediaQuery", () => {
	it("reads the viewport and follows it across the boundary", () => {
		const viewport = stubMatchMedia(false);
		const isMobile = mediaQuery("(max-width: 767px)");
		expect(isMobile.get()).toBe(false);

		const seen: boolean[] = [];
		const stop = isMobile.subscribe((value) => seen.push(value));
		viewport.set(true);
		viewport.set(false);

		// `subscribe` reports changes, not the value already in hand
		expect(seen).toEqual([true, false]);
		stop();
	});

	it("listens only while something is listening to it", () => {
		const viewport = stubMatchMedia(false);
		const isMobile = mediaQuery("(max-width: 767px)");
		expect(viewport.listeners).toBe(0);

		const first = isMobile.subscribe(() => {});
		const second = isMobile.subscribe(() => {});
		// one readable, one listener, however many readers it has
		expect(viewport.listeners).toBe(1);

		first();
		expect(viewport.listeners).toBe(1);
		second();
		expect(viewport.listeners).toBe(0);
	});

	it("reports the fallback where there is no matchMedia to ask", () => {
		vi.stubGlobal("matchMedia", undefined);
		expect(mediaQuery("(max-width: 767px)").get()).toBe(false);
		expect(mediaQuery("(min-width: 768px)", { fallback: true }).get()).toBe(true);
	});

	it("drives a branch of the tree", async () => {
		const viewport = stubMatchMedia(false);
		const isMobile = mediaQuery("(max-width: 767px)");
		const target = document.createElement("div");
		App({ target }).render(Div(If(isMobile).Then(Span("drawer")).Else(Span("dialog"))));
		await tick();

		expect(target.textContent).toBe("dialog");
		viewport.set(true);
		expect(target.textContent).toBe("drawer");
		viewport.set(false);
		expect(target.textContent).toBe("dialog");
	});
});

/** The same tree on both sides of a hydration, built fresh for each. */
const buildBranch = () => {
	const isMobile = mediaQuery("(max-width: 767px)");
	return Div(If(isMobile).Then(Span("drawer")).Else(Span("dialog")));
};

describe("mediaQuery during hydration", () => {
	it("matches the server through the pass, then catches up", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// the server has no matchMedia to ask, so it renders the fallback
		vi.stubGlobal("matchMedia", undefined);
		const { html } = renderToString(buildBranch());
		expect(html).toContain("dialog");

		// ...and the browser adopting that markup is a phone, which disagrees
		stubMatchMedia(true);
		const target = document.createElement("div");
		target.innerHTML = `<div data-ssr style="display: contents">${html}</div>`;
		document.body.appendChild(target);
		const wrapper = target.firstElementChild as HTMLElement;
		App({ target }).render(buildBranch());

		// the pass held the fallback, so the server's markup was adopted whole
		expect(warn).not.toHaveBeenCalled();
		expect(wrapper.textContent).toBe("dialog");

		// and the real viewport arrives on the other side of the pass
		await tick();
		expect(wrapper.textContent).toBe("drawer");

		target.remove();
		warn.mockRestore();
	});
});
