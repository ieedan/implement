/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading values back off a `RouteData` readable requires intentional narrowing. */
import type { Mountable, Readable } from "@implementjs/core";
import type { RouterError } from "@implementjs/router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteData } from "../src/match.ts";
import {
	invalidate,
	invalidateAll,
	registerErrorRoutes,
	registerRoutes,
	renderErrorPage,
	routeData,
	seedData,
} from "../src/runtime.ts";

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

describe("renderErrorPage", () => {
	/** What a layout was handed, recorded instead of rendered. */
	type Rendered = { layout: string; children: unknown; slug: unknown };

	const rendered: Rendered[] = [];
	const pages: string[] = [];

	/** A layout that records what it was handed and renders as its own name. */
	const layout =
		(name: string) => (children: Mountable, params: Record<string, Readable<unknown>>) => {
			rendered.push({ layout: name, children, slug: params["slug"]?.get() });
			return name;
		};

	const errorPage = (name: string) => (error: RouterError) => {
		pages.push(`${name}:${error.code}`);
		return name;
	};

	/** The root boundary, plus one for the app shell — the tree ENG-5 is about. */
	function boundaries(): void {
		rendered.length = 0;
		pages.length = 0;
		registerErrorRoutes([
			{
				pattern: "/",
				modules: ["src/routes/layout.ts"],
				layouts: [layout("root")],
				page: errorPage("root-error"),
			},
			{
				pattern: "/app/:slug",
				modules: ["src/routes/layout.ts", "src/routes/app/[slug]/layout.ts"],
				layouts: [layout("root"), layout("shell")],
				page: errorPage("shell-error"),
			},
		]);
	}

	it("picks the nearest error.ts above the path, and renders it inside its layouts", () => {
		boundaries();
		// a 404 deep inside the app shell: the sidebar and the workspace switcher
		// live in the shell layout, and losing them is the whole complaint
		renderErrorPage({ code: 404, message: "Not Found" }, "/app/acme/issue/9999");

		expect(pages).toEqual(["shell-error:404"]);
		expect(rendered.map((call) => call.layout)).toEqual(["shell", "root"]);
		// the section's params are bound, so the shell knows which workspace it is
		expect(rendered.map((call) => call.slug)).toEqual(["acme", "acme"]);
		// built innermost first: the root layout's child is the shell's render
		expect(rendered[1]?.children).toBeTypeOf("function");
	});

	it("falls back to the root error page for a section that has none", () => {
		boundaries();
		renderErrorPage({ code: 404, message: "Not Found" }, "/marketing/pricing");

		expect(pages).toEqual(["root-error:404"]);
		expect(rendered.map((call) => call.layout)).toEqual(["root"]);
	});

	it("renders nothing when no error.ts covers the path", () => {
		rendered.length = 0;
		pages.length = 0;
		registerErrorRoutes([
			{
				pattern: "/app/:slug",
				modules: [],
				layouts: [],
				page: errorPage("shell-error"),
			},
		]);

		expect(renderErrorPage({ code: 500, message: "Internal Error" }, "/")).toBeNull();
		expect(renderErrorPage({ code: 500, message: "Internal Error" }, "/app/acme")).not.toBeNull();
	});
});
