// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { afterEach, describe, expect, it } from "vitest";
import { focusFirst, tabbable, trapFocus } from "../src/lib/focus";

/**
 * happy-dom has no layout, so every element reports one rect no matter how it
 * is styled. Taking the rects away is how a test says "this one is not drawn",
 * the same way the collapse tests hand back a fixed `getBoundingClientRect`.
 */
function unrender(el: HTMLElement) {
	el.getClientRects = () => [] as unknown as DOMRectList;
}

function container(html: string): HTMLElement {
	const el = document.createElement("div");
	el.innerHTML = html;
	document.body.appendChild(el);
	return el;
}

/** A Tab keydown that reports whether the trap cancelled it. */
function tab(el: HTMLElement, { shift = false } = {}) {
	const e = new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, cancelable: true });
	trapFocus(e, el);
	return { prevented: e.defaultPrevented };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("tabbable", () => {
	it("keeps the elements the browser would actually stop on", () => {
		const el = container(`
			<button id="first">First</button>
			<input id="second" />
			<a id="third" href="/somewhere">Third</a>
		`);

		expect(tabbable(el).map((candidate) => candidate.id)).toEqual(["first", "second", "third"]);
	});

	it("drops candidates that are in the DOM but not rendered", () => {
		const el = container(`
			<button id="first">First</button>
			<input id="file" type="file" style="display: none" />
			<button id="last">Last</button>
		`);
		unrender(el.querySelector<HTMLElement>("#file")!);

		expect(tabbable(el).map((candidate) => candidate.id)).toEqual(["first", "last"]);
	});

	it("drops hidden and inert candidates, which are drawn or not but never focusable", () => {
		const el = container(`
			<button id="first">First</button>
			<button id="hidden" hidden>Hidden</button>
			<div inert>
				<button id="inert">Inert</button>
			</div>
			<button id="last">Last</button>
		`);

		expect(tabbable(el).map((candidate) => candidate.id)).toEqual(["first", "last"]);
	});
});

describe("trapFocus", () => {
	it("skips an unrendered candidate instead of stopping on it", () => {
		const el = container(`
			<input id="first" />
			<input id="hidden" type="file" style="display: none" />
			<input id="last" />
		`);
		unrender(el.querySelector<HTMLElement>("#hidden")!);

		const first = el.querySelector<HTMLElement>("#first")!;
		first.focus();

		const { prevented } = tab(el);

		expect(document.activeElement?.id).toBe("last");
		expect(prevented).toBe(true);
	});

	it("wraps from the last candidate back to the first", () => {
		const el = container(`
			<button id="first">First</button>
			<button id="last">Last</button>
		`);
		el.querySelector<HTMLElement>("#last")!.focus();

		expect(tab(el).prevented).toBe(true);
		expect(document.activeElement?.id).toBe("first");

		expect(tab(el, { shift: true }).prevented).toBe(true);
		expect(document.activeElement?.id).toBe("last");
	});

	it("leaves the keystroke alone when the candidate turns focus down", () => {
		const el = container(`
			<button id="first">First</button>
			<button id="stubborn">Stubborn</button>
		`);

		const first = el.querySelector<HTMLElement>("#first")!;
		const stubborn = el.querySelector<HTMLElement>("#stubborn")!;
		// a candidate the layout draws but the browser will not focus: the trap
		// has nowhere to send Tab, so native Tab has to remain available
		stubborn.focus = () => {};
		first.focus();

		const { prevented } = tab(el);

		expect(document.activeElement?.id).toBe("first");
		expect(prevented).toBe(false);
	});
});

describe("focusFirst", () => {
	it("starts at the first rendered candidate", () => {
		const el = container(`
			<input id="hidden" type="file" style="display: none" />
			<input id="first" />
		`);
		unrender(el.querySelector<HTMLElement>("#hidden")!);

		focusFirst(el);

		expect(document.activeElement?.id).toBe("first");
	});
});
