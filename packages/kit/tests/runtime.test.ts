/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading values back off a `RouteData` readable requires intentional narrowing. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteData } from "../src/match.ts";
import { invalidate, invalidateAll, registerRoutes, routeData, seedData } from "../src/runtime.ts";

/** Where the browser is — what `invalidate` reads to know which loads to re-run. */
function browserAt(path: string, search = ""): void {
	vi.stubGlobal("window", { location: { pathname: path, search } });
}

/**
 * Stands in for the `__data.json` endpoint, answering with whatever the
 * "server" holds at the moment it is asked. Returns the URLs it was asked for.
 */
function serving(produce: () => RouteData): string[] {
	const requested: string[] = [];
	vi.stubGlobal("fetch", (url: string) => {
		requested.push(url);
		return Promise.resolve(Response.json(produce()));
	});
	return requested;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("invalidate", () => {
	it("re-runs the page's loads and hands the new data to what is already mounted", async () => {
		const file = "issues/page.server.ts";
		registerRoutes([{ pattern: "/issues", files: [file] }]);
		// what a mutation writes and the load reads back
		let issues = ["write the issue"];
		serving(() => ({ [file]: { issues } }));
		browserAt("/issues");
		seedData({ [file]: { issues } });

		// the readable a page holds, subscribed once, the way a mounted component
		// holds its `data`
		const data = routeData([file]);
		const updates: string[][] = [];
		data.subscribe((value) => updates.push(value["issues"] as string[]));
		expect(data.get()).toEqual({ issues: ["write the issue"] });

		issues = [...issues, "fix the issue"];
		await invalidate();

		// the same subscription, no remount, the new value
		expect(updates).toEqual([["write the issue", "fix the issue"]]);
		expect(data.get()).toEqual({ issues: ["write the issue", "fix the issue"] });
	});

	it("asks for the page's own url, query string included", async () => {
		const file = "search/page.server.ts";
		registerRoutes([{ pattern: "/search", files: [file] }]);
		const requested = serving(() => ({ [file]: { hits: 1 } }));
		browserAt("/search", "?q=kit");

		await invalidate();

		expect(requested).toEqual(["/search/__data.json?q=kit"]);
	});

	it("runs for a layout above the page, and stays out of the way for another route", async () => {
		const layout = "app/[slug]/layout.server.ts";
		const pageFile = "app/[slug]/issue/[number]/page.server.ts";
		registerRoutes([{ pattern: "/app/:slug/issue/:number", files: [layout, pageFile] }]);
		const requested = serving(() => ({ [layout]: { unread: 0 }, [pageFile]: {} }));
		browserAt("/app/acme/issue/12");
		seedData({ [layout]: { unread: 3 }, [pageFile]: {} });

		// a route the page is not inside says nothing about the page's data
		await invalidate("/app/:slug/settings");
		expect(requested).toEqual([]);

		// the shell around the page is, so the unread count in it re-runs
		await invalidate("/app/:slug");
		expect(requested).toEqual(["/app/acme/issue/12/__data.json"]);
		expect(routeData([layout]).get()).toEqual({ unread: 0 });
	});

	it("takes a concrete path as readily as a pattern", async () => {
		const file = "inbox/page.server.ts";
		registerRoutes([{ pattern: "/inbox", files: [file] }]);
		const requested = serving(() => ({ [file]: { unread: 0 } }));
		browserAt("/inbox");

		await invalidate("/inbox");

		expect(requested).toEqual(["/inbox/__data.json"]);
	});

	it("drops an answer a newer invalidation has already overtaken", async () => {
		const file = "badge/page.server.ts";
		registerRoutes([{ pattern: "/badge", files: [file] }]);
		const pending: ((data: RouteData) => void)[] = [];
		vi.stubGlobal(
			"fetch",
			() =>
				new Promise<Response>((resolve) => {
					pending.push((data) => resolve(Response.json(data)));
				}),
		);
		browserAt("/badge");
		seedData({ [file]: { unread: 9 } });

		const first = invalidate();
		const second = invalidate();
		// the newer request answers first; the older one is the stale read
		// however the network ordered the two
		pending[1]!({ [file]: { unread: 0 } });
		await second;
		pending[0]!({ [file]: { unread: 9 } });
		await first;

		expect(routeData([file]).get()).toEqual({ unread: 0 });
	});

	it("does nothing for a route with no loads", async () => {
		registerRoutes([{ pattern: "/loaded", files: ["loaded/page.server.ts"] }]);
		const requested = serving(() => ({}));
		browserAt("/plain");

		await invalidate();

		expect(requested).toEqual([]);
	});

	it("is a no-op on the server, where the render's loads have only just run", async () => {
		const requested = serving(() => ({}));

		await expect(invalidate()).resolves.toBeUndefined();

		expect(requested).toEqual([]);
	});
});

describe("invalidateAll", () => {
	it("re-runs every load feeding the page", async () => {
		const layout = "shell/layout.server.ts";
		const pageFile = "shell/reports/page.server.ts";
		registerRoutes([{ pattern: "/shell/reports", files: [layout, pageFile] }]);
		serving(() => ({ [layout]: { unread: 0 }, [pageFile]: { rows: 2 } }));
		browserAt("/shell/reports");
		seedData({ [layout]: { unread: 4 }, [pageFile]: { rows: 1 } });

		await invalidateAll();

		expect(routeData([layout, pageFile]).get()).toEqual({ unread: 0, rows: 2 });
	});
});
