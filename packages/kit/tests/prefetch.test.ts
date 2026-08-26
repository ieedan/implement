// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTED_LINK_ATTRIBUTE } from "@implementjs/router";
import { lazyModule, registerRouteModules } from "../src/lazy.ts";
import { initPreloading } from "../src/prefetch.ts";
import { registerRoutes } from "../src/runtime.ts";

/**
 * The tests drive the DOM the way a pointer does — `pointerover` on the
 * element actually under it, which is a link's *text* as often as the link —
 * since delegation from the deepest target is the thing that has to work.
 */

type Fixture = {
	/** The route's path, and what a link in the fixture points at. */
	path: string;
	/** Its module id, which is what shows up in `loaded`. */
	id: string;
	/** Where its serialized load results would be fetched from. */
	data: string;
};

let next = 0;

/**
 * Registers `count` routes under paths nothing else in the file has used.
 *
 * The module handles and the preloaded-data cache are process-wide singletons
 * — the runtime they model is one page — so a path reused across tests carries
 * whatever the earlier one left loaded, and the assertion that something was
 * warmed passes or fails on history rather than on this test.
 */
function routes(
	count: number,
	options: { loads?: boolean } = {},
): Fixture[] & { loaded: string[] } {
	const loaded: string[] = [];
	const list = Array.from({ length: count }, (): Fixture => {
		const name = `r${next++}`;
		return { path: `/${name}`, id: `routes/${name}/page.ts`, data: `/${name}/__data.json` };
	});
	for (const route of list) {
		lazyModule(route.id, () => {
			loaded.push(route.id);
			return Promise.resolve({ default: route.id });
		});
	}
	registerRouteModules(list.map((route) => ({ pattern: route.path, modules: [route.id] })));
	registerRoutes(
		options.loads
			? list.map((route) => ({
					pattern: route.path,
					files: [`${route.path.slice(1)}/page.server.ts`],
				}))
			: [],
	);
	return Object.assign(list, { loaded });
}

let teardown: (() => void) | null = null;
let fetched: string[] = [];

beforeEach(() => {
	fetched = [];
	document.body.innerHTML = "";
	registerRouteModules([]);
	registerRoutes([]);
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) => {
			fetched.push(url);
			return Promise.resolve(
				new Response(JSON.stringify({ "page.server.ts": { ok: true } }), {
					headers: { "content-type": "application/json" },
				}),
			);
		}),
	);
});

afterEach(() => {
	teardown?.();
	teardown = null;
	vi.unstubAllGlobals();
});

/** Installs the behaviour, then renders `html` into the document. */
function mount(html: string, options?: Parameters<typeof initPreloading>[0]): HTMLElement {
	teardown = initPreloading(options);
	document.body.innerHTML = html;
	return document.body;
}

const hover = (element: Element) => {
	element.dispatchEvent(new Event("pointerover", { bubbles: true }));
};

const tap = (element: Element) => {
	element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
};

/** Lets the preload's promise chain settle before asserting on what it did. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * What the router puts on an `<a>` it follows itself. The inherited default
 * only reaches these — a plain `<a>` is a full document load, and warming its
 * route is work the click throws away.
 */
const routed = ROUTED_LINK_ATTRIBUTE;

describe("preloading on hover", () => {
	it("loads the destination's chunks when the pointer arrives", async () => {
		const fixtures = routes(1);
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}><span>About</span></a>`);

		// the pointer is over the text, not the anchor — delegation has to walk up
		hover(body.querySelector("span")!);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
	});

	it("fetches the destination's data for a route that has a load", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`);

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("does not fetch data for a route with no load", async () => {
		const fixtures = routes(1);
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`);

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
		expect(fetched).toEqual([]);
	});

	it("fetches once however many times the pointer crosses the link", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}><span>A</span><span>B</span></a>`);

		for (const span of body.querySelectorAll("span")) hover(span);
		hover(body.querySelector("a")!);
		await settle();

		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("warms a link reached with the keyboard", async () => {
		const fixtures = routes(1);
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`);

		body.querySelector("a")!.dispatchEvent(new Event("focusin", { bubbles: true }));
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
	});
});

describe("links a preload leaves alone", () => {
	it.each([
		["another origin", () => `<a href="https://example.com/away">Away</a>`],
		["a new tab", (path: string) => `<a href="${path}" ${routed} target="_blank">About</a>`],
		["a download", (path: string) => `<a href="${path}" ${routed} download>About</a>`],
		["an external link", (path: string) => `<a href="${path}" ${routed} rel="external">About</a>`],
		["a bare fragment", () => `<a href="#section">Section</a>`],
		["a mailto", () => `<a href="mailto:hi@example.com">Mail</a>`],
		["no href at all", () => `<a>Nowhere</a>`],
	])("skips %s", async (_, html) => {
		const fixtures = routes(1, { loads: true });
		const body = mount(html(fixtures[0]!.path));

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([]);
		expect(fetched).toEqual([]);
	});

	it("skips a link back to the page already on screen", async () => {
		const loaded: string[] = [];
		lazyModule("routes/page.ts", () => {
			loaded.push("routes/page.ts");
			return Promise.resolve({ default: "home" });
		});
		registerRouteModules([{ pattern: "/", modules: ["routes/page.ts"] }]);
		const body = mount(`<a href="/" ${routed}>Home</a>`);

		hover(body.querySelector("a")!);
		await settle();

		expect(loaded).toEqual([]);
	});
});

describe("the data attributes", () => {
	it("takes the setting from the nearest ancestor that declares one", async () => {
		const fixtures = routes(2, { loads: true });
		const [a, b] = fixtures;
		const body = mount(
			`<div data-implement-preload-data="hover">
				<a href="${a!.path}" id="a">A</a>
				<nav data-implement-preload-data="off"><a href="${b!.path}" id="b">B</a></nav>
			</div>`,
			{ data: "off", code: "off" },
		);

		hover(body.querySelector("#a")!);
		hover(body.querySelector("#b")!);
		await settle();

		expect(fetched).toEqual([a!.data]);
		expect(fixtures.loaded).toEqual([a!.id]);
	});

	it("holds a `tap` link back until the pointer goes down", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(
			`<a href="${fixtures[0]!.path}" ${routed} data-implement-preload-data="tap">Report</a>`,
			{ code: "off" },
		);
		const link = body.querySelector("a")!;

		hover(link);
		await settle();
		expect(fetched).toEqual([]);

		tap(link);
		await settle();
		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("still preloads code on hover for a link whose data is held to tap", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(
			`<a href="${fixtures[0]!.path}" ${routed} data-implement-preload-data="tap">Report</a>`,
		);

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
		expect(fetched).toEqual([]);
	});

	it("ignores a value that is not a kind rather than throwing on it", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(
			`<a href="${fixtures[0]!.path}" ${routed} data-implement-preload-data="sometimes">About</a>`,
		);

		hover(body.querySelector("a")!);
		await settle();

		// the default still applies, so the typo costs the setting, not the link
		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("warms an eager link's code as soon as it is in the document", async () => {
		const fixtures = routes(1, { loads: true });
		mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`, { data: "off", code: "eager" });
		// the scan runs off a MutationObserver, which is a microtask behind the write
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
		expect(fetched).toEqual([]);
	});

	it("warms an eager link added after the install", async () => {
		const fixtures = routes(1);
		mount("", { data: "off", code: "eager" });

		const anchor = document.createElement("a");
		anchor.href = fixtures[0]!.path;
		anchor.setAttribute(routed, "");
		document.body.append(anchor);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
	});
});

describe("what the default reaches", () => {
	it("warms a link the router follows itself", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>Routed</a>`);

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([fixtures[0]!.id]);
		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("leaves a plain link alone, since following it reloads the document", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(`<a href="${fixtures[0]!.path}">Plain</a>`);

		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([]);
		expect(fetched).toEqual([]);
	});

	it("warms a plain link the app asked for by name", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(
			`<a href="${fixtures[0]!.path}" data-implement-preload-data="hover">Asked for</a>`,
		);

		hover(body.querySelector("a")!);
		await settle();

		expect(fetched).toEqual([fixtures[0]!.data]);
	});

	it("skips a plain link under a subtree that asked, only where it asked", async () => {
		const fixtures = routes(2, { loads: true });
		const [inside, outside] = fixtures;
		const body = mount(
			`<div>
				<nav data-implement-preload-data="hover"><a href="${inside!.path}" id="in">In</a></nav>
				<a href="${outside!.path}" id="out">Out</a>
			</div>`,
		);

		hover(body.querySelector("#in")!);
		hover(body.querySelector("#out")!);
		await settle();

		expect(fetched).toEqual([inside!.data]);
	});

	it("holds off entirely while the reader has asked to save data", async () => {
		const fixtures = routes(1, { loads: true });
		const connection = { saveData: true };
		Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
		try {
			const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`);

			hover(body.querySelector("a")!);
			tap(body.querySelector("a")!);
			await settle();

			expect(fixtures.loaded).toEqual([]);
			expect(fetched).toEqual([]);
		} finally {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Removing the non-standard property the test defined.
			delete (navigator as unknown as Record<string, unknown>)["connection"];
		}
	});
});

describe("teardown", () => {
	it("stops preloading once torn down", async () => {
		const fixtures = routes(1, { loads: true });
		const body = mount(`<a href="${fixtures[0]!.path}" ${routed}>About</a>`);

		teardown!();
		teardown = null;
		hover(body.querySelector("a")!);
		await settle();

		expect(fixtures.loaded).toEqual([]);
		expect(fetched).toEqual([]);
	});
});
