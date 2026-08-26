// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateTo, setNavigationResolver } from "@implementjs/core";
import { lazyModule, registerRouteModules } from "../src/lazy.ts";
import {
	initClientData,
	preloadCode,
	preloadData,
	registerRoutes,
	routeData,
} from "../src/runtime.ts";

/**
 * The seam `preloadData` exists for: a payload fetched ahead of the click has
 * to be *waiting* rather than applied — seeding it would re-render the page
 * the reader is still on — and the navigation that follows has to spend it
 * instead of fetching the same thing again.
 */

let next = 0;
let calls = 0;

type Fixture = {
	/** The route's path, which is also what a preload is asked for. */
	path: string;
	/** Its module id. */
	id: string;
	/** The server file its load results are keyed by. */
	file: string;
};

/** The fixture the stubbed fetch answers for, so its payload lands under a real key. */
let current: Fixture | null = null;

/**
 * A route under a path nothing else in the file has touched. The module
 * handles and the preloaded-data cache are process-wide singletons — the
 * runtime they model is one page — so a reused path would carry whatever an
 * earlier test left in them.
 */
function route(options: { loads?: boolean } = {}): Fixture {
	const name = `p${next++}`;
	const fixture: Fixture = {
		path: `/${name}`,
		id: `routes/${name}/page.ts`,
		file: `${name}/page.server.ts`,
	};
	lazyModule(fixture.id, () => Promise.resolve({ default: fixture.id }));
	registerRouteModules([{ pattern: fixture.path, modules: [fixture.id] }]);
	registerRoutes(options.loads ? [{ pattern: fixture.path, files: [fixture.file] }] : []);
	current = fixture;
	return fixture;
}

/** Lets the promise chain behind a navigation settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	calls = 0;
	current = null;
	registerRouteModules([]);
	registerRoutes([]);
	vi.stubGlobal(
		"fetch",
		vi.fn(() => {
			calls++;
			// numbered, so a second fetch for the same route is visible in what
			// the payload says rather than only in the call count
			const body = JSON.stringify({ [current?.file ?? "unknown"]: { fetch: calls } });
			return Promise.resolve(
				new Response(body, { headers: { "content-type": "application/json" } }),
			);
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	setNavigationResolver(null);
});

describe("preloadData", () => {
	it("fetches a route's data without applying it to the page on screen", async () => {
		const fixture = route({ loads: true });
		const data = routeData([fixture.file]);

		await preloadData(fixture.path);

		expect(calls).toBe(1);
		expect(data.get()).toEqual({});
	});

	it("joins a fetch already in flight rather than starting a second", async () => {
		const fixture = route({ loads: true });

		const [first, second] = await Promise.all([
			preloadData(fixture.path),
			preloadData(fixture.path),
		]);

		expect(calls).toBe(1);
		expect(first).toEqual(second);
	});

	it("reuses what an earlier preload of the same route left waiting", async () => {
		const fixture = route({ loads: true });

		await preloadData(fixture.path);
		await preloadData(fixture.path);

		expect(calls).toBe(1);
	});

	it("resolves with null for a route with no load, having preloaded its code", async () => {
		const fixture = route();

		await expect(preloadData(fixture.path)).resolves.toBeNull();
		expect(calls).toBe(0);
	});

	it("does nothing for a path no route in the app serves", async () => {
		route({ loads: true });

		await expect(preloadData("/nowhere-at-all")).resolves.toBeNull();
		expect(calls).toBe(0);
	});

	it("resolves a relative href against the current document", async () => {
		const fixture = route({ loads: true });

		await preloadData(fixture.path.slice(1));

		expect(calls).toBe(1);
	});

	it("leaves nothing behind when the fetch fails, so the navigation retries", async () => {
		const fixture = route({ loads: true });
		vi.stubGlobal(
			"fetch",
			vi.fn(() => {
				calls++;
				return Promise.resolve(new Response("nope", { status: 500 }));
			}),
		);

		await expect(preloadData(fixture.path)).rejects.toThrow(/500/);
		await expect(preloadData(fixture.path)).rejects.toThrow(/500/);

		expect(calls).toBe(2);
	});

	it("stops serving a payload once it has gone stale", async () => {
		vi.useFakeTimers();
		const fixture = route({ loads: true });

		await preloadData(fixture.path);
		expect(calls).toBe(1);

		vi.setSystemTime(Date.now() + 60_000);
		await preloadData(fixture.path);

		expect(calls).toBe(2);
	});
});

describe("the navigation that follows", () => {
	it("spends the preload instead of fetching the route's data again", async () => {
		const fixture = route({ loads: true });
		const data = routeData([fixture.file]);
		initClientData();

		await preloadData(fixture.path);
		expect(calls).toBe(1);

		navigateTo(fixture.path);
		await settle();

		// the same payload, now applied — and no second round trip under the click
		expect(calls).toBe(1);
		expect(data.get()).toEqual({ fetch: 1 });
	});

	it("fetches for itself when nothing was preloaded", async () => {
		const fixture = route({ loads: true });
		const data = routeData([fixture.file]);
		initClientData();

		navigateTo(fixture.path);
		await settle();

		expect(calls).toBe(1);
		expect(data.get()).toEqual({ fetch: 1 });
	});
});

describe("preloadCode", () => {
	it("loads a route's chunks without touching its data", async () => {
		const fixture = route({ loads: true });

		await preloadCode(fixture.path);

		expect(calls).toBe(0);
	});

	it("takes several paths at once", async () => {
		const first = route();
		const second = route();
		registerRouteModules([
			{ pattern: first.path, modules: [first.id] },
			{ pattern: second.path, modules: [second.id] },
		]);

		await expect(preloadCode(first.path, second.path)).resolves.toBeUndefined();
	});
});
