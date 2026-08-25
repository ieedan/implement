/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back JSON bodies and stubbing globals requires intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import type { EndpointRoute, PageRoute, RequestEvent } from "../src/match.ts";
import {
	createKitServer,
	error,
	redirect,
	sequence,
	type Handle,
	type KitServerOptions,
	type ServerErrorReport,
	type ServerHooks,
} from "../src/server.ts";

type Locals = { user?: string };

const localsOf = (event: RequestEvent): Locals => event.locals;

const page = (pattern: string, files: PageRoute["files"] = []): PageRoute => ({
	pattern,
	id: pattern,
	files,
});

const endpoint = (pattern: string, module: Record<string, unknown>): EndpointRoute => ({
	pattern,
	id: pattern,
	extension: null,
	file: `${pattern}/server.ts`,
	module,
});

/** A server over one page, one load-bearing page, and one endpoint. */
function server(hooks: ServerHooks = {}, overrides: Partial<KitServerOptions> = {}) {
	return createKitServer({
		hooks,
		pages: [
			page("/"),
			page("/loaded", [
				{ id: "loaded/page.server.ts", load: (event) => ({ user: localsOf(event).user ?? null }) },
			]),
			page("/users/:id"),
		],
		endpoints: [
			endpoint("/api", {
				GET: (event: RequestEvent) => Response.json({ user: localsOf(event).user ?? null }),
			}),
			endpoint("/write", { POST: () => new Response(null, { status: 204 }) }),
		],
		renderPage: ({ url, error: pageError }) => ({
			html: pageError === null ? `<p>${url.pathname}</p>` : `<p>${pageError.message}</p>`,
			head: "",
		}),
		...overrides,
	});
}

/** Runs a request through a server, with the document sink a dev server would provide. */
const get = (kit: ReturnType<typeof server>, path: string, init?: RequestInit) =>
	kit.respond(new Request(`http://localhost${path}`, init), {
		document: ({ render, transform }) => {
			const html = `<html><head></head><body>${render.html}</body></html>`;
			return transform === null ? html : transform(html);
		},
	});

describe("the request pipeline", () => {
	it("renders a matched page and 404s an unmatched one", async () => {
		const kit = server();
		const home = await get(kit, "/");
		expect(home.status).toBe(200);
		expect(home.headers.get("content-type")).toContain("text/html");
		expect(await home.text()).toContain("<p>/</p>");

		expect((await get(kit, "/nope")).status).toBe(404);
	});

	it("dispatches endpoints and rejects unsupported methods with a 405", async () => {
		const kit = server();
		expect(await (await get(kit, "/api")).json()).toEqual({ user: null });

		const rejected = await get(kit, "/write");
		expect(rejected.status).toBe(405);
		expect(rejected.headers.get("allow")).toBe("POST");
	});

	it("serves __data.json for a load-bearing route and 404s the rest", async () => {
		const kit = server();
		const data = await get(kit, "/loaded/__data.json");
		expect(data.status).toBe(200);
		expect(await data.json()).toEqual({ "loaded/page.server.ts": { user: null } });

		expect((await get(kit, "/__data.json")).status).toBe(404);
	});

	it("gives the event the page's url and params, data request or not", async () => {
		const events: RequestEvent[] = [];
		const kit = server({
			handle: ({ event, resolve }) => {
				events.push(event);
				return resolve(event);
			},
		});
		await get(kit, "/users/42?q=1");
		await get(kit, "/loaded/__data.json");
		expect(events[0]?.params).toEqual({ id: "42" });
		expect(events[0]?.route.id).toBe("/users/:id");
		expect(events[0]?.isDataRequest).toBe(false);
		expect(events[1]?.url.pathname).toBe("/loaded");
		expect(events[1]?.isDataRequest).toBe(true);
	});
});

describe("the load chain", () => {
	/** A server over one page at `/section/:slug/page`, fed by the chain given. */
	const chained = (files: PageRoute["files"]) =>
		createKitServer({
			hooks: {},
			pages: [page("/section/:slug/page", files)],
			endpoints: [],
			renderPage: () => ({ html: "", head: "" }),
		});

	const chainData = async (files: PageRoute["files"]) =>
		await (await get(chained(files), "/section/acme/page/__data.json")).json();

	it("gives a load what the loads above it returned, merged root first", async () => {
		/** How many times the section's authorization decision was made. */
		let memberships = 0;
		const data = await chainData([
			{ id: "layout.server.ts", load: () => ({ user: "ada" }) },
			{
				id: "section/[slug]/layout.server.ts",
				load: async ({ parent, params }) => {
					memberships++;
					const { user } = (await parent()) as { user: string };
					return { workspace: `${user}/${params.slug}` };
				},
			},
			{
				id: "section/[slug]/page/page.server.ts",
				load: async ({ parent }) => ({ above: await parent() }),
			},
		]);
		expect(data).toEqual({
			"layout.server.ts": { user: "ada" },
			"section/[slug]/layout.server.ts": { workspace: "ada/acme" },
			// two layouts deep, merged the way the component's `data` is
			"section/[slug]/page/page.server.ts": {
				above: { user: "ada", workspace: "ada/acme" },
			},
		});
		// the decision the layout made is the one the page read, not a second one
		expect(memberships).toBe(1);
	});

	it("resolves the root load's parent() to nothing, rather than waiting on itself", async () => {
		const data = await chainData([
			{ id: "layout.server.ts", load: async ({ parent }) => ({ above: await parent() }) },
		]);
		expect(data).toEqual({ "layout.server.ts": { above: {} } });
	});

	it("lets a later load win a key its parent already set", async () => {
		const data = await chainData([
			{ id: "layout.server.ts", load: () => ({ title: "section" }) },
			{ id: "page.server.ts", load: async ({ parent }) => await parent() },
		]);
		expect(data).toEqual({
			"layout.server.ts": { title: "section" },
			"page.server.ts": { title: "section" },
		});
	});

	it("starts every load at once, so one that waits on nothing waits for nothing", async () => {
		let releaseLayout!: () => void;
		const layoutHeld = new Promise<void>((release) => {
			releaseLayout = release;
		});
		let pageRan!: () => void;
		const pageStarted = new Promise<void>((ran) => {
			pageRan = ran;
		});
		const kit = chained([
			{
				id: "layout.server.ts",
				load: async () => {
					await layoutHeld;
					return { slow: true };
				},
			},
			{
				id: "page.server.ts",
				load: () => {
					pageRan();
					return { fast: true };
				},
			},
		]);
		const pending = get(kit, "/section/acme/page/__data.json");
		// the page's load never calls parent(), so nothing about the layout above
		// it is in its way — were the chain still a waterfall this would hang
		await pageStarted;
		releaseLayout();
		expect(await (await pending).json()).toEqual({
			"layout.server.ts": { slow: true },
			"page.server.ts": { fast: true },
		});
	});

	it("answers with the root-most failure when more than one load throws", async () => {
		const kit = chained([
			{
				id: "layout.server.ts",
				load: async () => {
					// fails second, and is still the one the request is about: a page
					// under a layout that turned the request down has no answer to give
					await Promise.resolve();
					error(403, "not a member");
				},
			},
			{ id: "page.server.ts", load: () => error(404, "no such issue") },
		]);
		const response = await get(kit, "/section/acme/page/__data.json");
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ message: "not a member" });
	});
});

describe("the handle hook", () => {
	it("passes locals from the hook into loads and endpoints", async () => {
		const hooks: ServerHooks = {
			handle: ({ event, resolve }) => {
				localsOf(event).user = "ada";
				return resolve(event);
			},
		};
		expect(await (await get(server(hooks), "/api")).json()).toEqual({ user: "ada" });
		expect(await (await get(server(hooks), "/loaded/__data.json")).json()).toEqual({
			"loaded/page.server.ts": { user: "ada" },
		});
	});

	it("lets the hook answer without resolving", async () => {
		const kit = server({ handle: () => new Response("nope", { status: 401 }) });
		const response = await get(kit, "/");
		expect(response.status).toBe(401);
		expect(await response.text()).toBe("nope");
	});

	it("lets the hook change the resolved response", async () => {
		const kit = server({
			handle: async ({ event, resolve }) => {
				const response = await resolve(event);
				response.headers.set("x-hooked", "yes");
				return response;
			},
		});
		expect((await get(kit, "/")).headers.get("x-hooked")).toBe("yes");
	});

	it("transforms the rendered page through transformPageChunk", async () => {
		const kit = server({
			handle: ({ event, resolve }) =>
				resolve(event, {
					transformPageChunk: ({ html, done }) =>
						html.replace("<head>", `<head><meta name="done" content="${done}">`),
				}),
		});
		expect(await (await get(kit, "/")).text()).toContain('<meta name="done" content="true">');
	});

	it("applies setHeaders to the resolved response", async () => {
		const kit = server({
			handle: ({ event, resolve }) => {
				event.setHeaders({ "cache-control": "max-age=60" });
				return resolve(event);
			},
		});
		expect((await get(kit, "/")).headers.get("cache-control")).toBe("max-age=60");
	});

	it("rejects a header set twice, and set-cookie outright", async () => {
		const twice = server({
			handle: ({ event, resolve }) => {
				event.setHeaders({ "x-a": "1" });
				event.setHeaders({ "X-A": "2" });
				return resolve(event);
			},
		});
		expect((await get(twice, "/")).status).toBe(500);

		const cookie = server({
			handle: ({ event, resolve }) => {
				event.setHeaders({ "set-cookie": "a=1" });
				return resolve(event);
			},
		});
		expect((await get(cookie, "/")).status).toBe(500);
	});

	it("answers with an error when init fails", async () => {
		const kit = server({
			init: () => {
				throw new Error("no database");
			},
			handleError: () => ({ message: "Starting up failed" }),
		});
		const response = await get(kit, "/");
		expect(response.status).toBe(500);
		expect(await response.text()).toContain("<p>Starting up failed</p>");
	});

	it("awaits init once, before the first request", async () => {
		const order: string[] = [];
		const kit = server({
			init: () => {
				order.push("init");
			},
			handle: ({ event, resolve }) => {
				order.push("handle");
				return resolve(event);
			},
		});
		await get(kit, "/");
		await get(kit, "/");
		expect(order).toEqual(["init", "handle", "handle"]);
	});
});

const trace =
	(name: string, log: string[]): Handle =>
	async ({ event, resolve }) => {
		log.push(`${name}:in`);
		const response = await resolve(event, {
			transformPageChunk: ({ html }) => `${html}<!--${name}-->`,
		});
		log.push(`${name}:out`);
		return response;
	};

describe("sequence", () => {
	it("runs handlers left to right, unwinding right to left", async () => {
		const log: string[] = [];
		const kit = server({ handle: sequence(trace("first", log), trace("second", log)) });
		await get(kit, "/");
		expect(log).toEqual(["first:in", "second:in", "second:out", "first:out"]);
	});

	it("merges transformPageChunk, inner handlers first", async () => {
		const log: string[] = [];
		const kit = server({ handle: sequence(trace("first", log), trace("second", log)) });
		expect(await (await get(kit, "/")).text()).toContain("<!--second--><!--first-->");
	});

	it("resolves straight through with no handlers", async () => {
		const kit = server({ handle: sequence() });
		expect((await get(kit, "/")).status).toBe(200);
	});
});

describe("error, redirect, and handleError", () => {
	it("turns a thrown redirect into a redirect response", async () => {
		const kit = server({ handle: () => redirect(303, "/login") });
		const response = await get(kit, "/");
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/login");
	});

	it("renders a thrown error on the error page, without calling handleError", async () => {
		const handleError = vi.fn();
		const kit = server({ handle: () => error(403, "Nope"), handleError });
		const response = await get(kit, "/");
		expect(response.status).toBe(403);
		expect(await response.text()).toContain("<p>Nope</p>");
		expect(handleError).not.toHaveBeenCalled();
	});

	it("sends an expected error as JSON for a data request", async () => {
		const kit = server({ handle: () => error(401, "Log in") });
		const response = await get(kit, "/loaded/__data.json");
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: "Log in" });
	});

	it("routes an unexpected error through handleError", async () => {
		const boom = new Error("boom");
		const handleError = vi.fn((_input: { error: unknown; status: number }) => ({
			message: "Something broke",
		}));
		const kit = server({
			handle: () => {
				throw boom;
			},
			handleError,
		});
		const response = await get(kit, "/");
		expect(response.status).toBe(500);
		expect(await response.text()).toContain("<p>Something broke</p>");
		expect(handleError.mock.calls[0]?.[0]).toMatchObject({ error: boom, status: 500 });
	});

	it("catches what a load throws", async () => {
		const kit = server(
			{},
			{
				pages: [
					page("/loaded", [
						{
							id: "loaded/page.server.ts",
							load: () => error(404, "No such thing"),
						},
					]),
				],
			},
		);
		const response = await get(kit, "/loaded");
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("<p>No such thing</p>");
	});

	it("falls back to plain text when the app has no error page", async () => {
		const kit = server({ handle: () => error(418, "Teapot") }, { renderPage: () => null });
		const response = await get(kit, "/");
		expect(response.status).toBe(418);
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe("Teapot");
	});
});

/** Runs a request through a server with a reporter attached, the way the dev server does. */
const reported = async (
	kit: ReturnType<typeof server>,
	path: string,
	init?: RequestInit,
): Promise<{ response: Response; reports: ServerErrorReport[] }> => {
	const reports: ServerErrorReport[] = [];
	const response = await kit.respond(new Request(`http://localhost${path}`, init), {
		document: ({ render }) => `<body>${render.html}</body>`,
		onError: (report) => reports.push(report),
	});
	return { response, reports };
};

describe("reporting errors to the host", () => {
	it("reports an unexpected error with the load that threw", async () => {
		const boom = new Error("boom");
		const kit = server(
			{},
			{
				pages: [
					page("/loaded", [
						{
							id: "loaded/page.server.ts",
							load: () => {
								throw boom;
							},
						},
					]),
				],
			},
		);
		const { response, reports } = await reported(kit, "/loaded");
		expect(response.status).toBe(500);
		expect(reports).toHaveLength(1);
		expect(reports[0]).toMatchObject({
			error: boom,
			status: 500,
			source: { kind: "load", file: "loaded/page.server.ts" },
		});
		expect(reports[0]?.event.url.pathname).toBe("/loaded");

		// and the same load reached through a client navigation's data request
		const data = await reported(kit, "/loaded/__data.json");
		expect(data.reports[0]?.source).toEqual({ kind: "load", file: "loaded/page.server.ts" });
	});

	it("reports an endpoint handler with its file and method", async () => {
		const kit = server(
			{},
			{
				endpoints: [
					endpoint("/api", {
						POST: () => {
							throw new Error("boom");
						},
					}),
				],
			},
		);
		const { reports } = await reported(kit, "/api", { method: "POST" });
		expect(reports[0]?.source).toEqual({
			kind: "endpoint",
			file: "/api/server.ts",
			method: "POST",
		});
	});

	it("reports a render that throws, and the error page that throws over it", async () => {
		const kit = server(
			{},
			{
				renderPage: () => {
					throw new Error("component blew up");
				},
			},
		);
		const { reports } = await reported(kit, "/");
		expect(reports.map((entry) => entry.source)).toEqual([
			{ kind: "render" },
			{ kind: "error-page" },
		]);
	});

	it("reports an error the hooks threw, with nothing else to attribute it to", async () => {
		const kit = server({
			handle: () => {
				throw new Error("boom");
			},
		});
		const { reports } = await reported(kit, "/users/7");
		expect(reports[0]?.source).toBeNull();
		expect(reports[0]?.event.route.id).toBe("/users/:id");
	});

	it("reports even when the app's handleError answers the request itself", async () => {
		const handleError = vi.fn(() => ({ message: "Something broke" }));
		const kit = server({
			handleError,
			handle: () => {
				throw new Error("boom");
			},
		});
		const { response, reports } = await reported(kit, "/");
		expect(reports).toHaveLength(1);
		expect(handleError).toHaveBeenCalledOnce();
		expect(await response.text()).toContain("<p>Something broke</p>");
	});

	it("reports before handleError, so a handleError that throws is not the last word", async () => {
		const boom = new Error("boom");
		const kit = server({
			handleError: () => {
				throw new Error("the reporter is down");
			},
			handle: () => {
				throw boom;
			},
		});
		const reports: ServerErrorReport[] = [];
		await expect(
			kit.respond(new Request("http://localhost/"), { onError: (report) => reports.push(report) }),
		).rejects.toThrow("the reporter is down");
		expect(reports[0]?.error).toBe(boom);
	});

	it("leaves expected errors and redirects alone", async () => {
		const kit = server({ handle: () => error(403, "Nope") });
		expect((await reported(kit, "/")).reports).toEqual([]);

		const away = server({ handle: () => redirect(303, "/login") });
		expect((await reported(away, "/")).reports).toEqual([]);
	});

	it("logs the error itself only when nothing is reporting", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const kit = server({
				handle: () => {
					throw new Error("boom");
				},
			});
			await reported(kit, "/");
			expect(logged).not.toHaveBeenCalled();

			await get(kit, "/");
			expect(logged).toHaveBeenCalledOnce();
		} finally {
			logged.mockRestore();
		}
	});
});

describe("render", () => {
	it("returns the page render for the prerenderer", async () => {
		const result = await server().render("/users/7");
		expect(result.html).toBe("<p>/users/7</p>");
		expect(result.transform).toBeUndefined();
	});

	it("carries the hook's page transform for the prerenderer to apply", async () => {
		const kit = server({
			handle: ({ event, resolve }) =>
				resolve(event, { transformPageChunk: ({ html }) => `${html}<!--stamped-->` }),
		});
		const result = await kit.render("/");
		expect(await result.transform?.("<html></html>")).toBe("<html></html><!--stamped-->");
	});

	it("explains itself when a hook answers a prerendered page with its own response", async () => {
		const kit = server({ handle: () => redirect(307, "/elsewhere") });
		await expect(kit.render("/")).rejects.toThrow(/did not render a page/);
	});
});

describe("event.fetch", () => {
	/** The event a server builds for a request, grabbed on the way through `handle`. */
	function capturing(overrides: Partial<KitServerOptions> = {}) {
		const events: RequestEvent[] = [];
		const kit = createKitServer({
			hooks: {
				handle: ({ event, resolve }) => {
					events.push(event);
					return resolve(event);
				},
			},
			pages: [],
			endpoints: [
				endpoint("/echo", {
					GET: (event: RequestEvent) =>
						Response.json({
							url: event.url.toString(),
							cookie: event.request.headers.get("cookie"),
							authorization: event.request.headers.get("authorization"),
							custom: event.request.headers.get("x-custom"),
						}),
					POST: async (event: RequestEvent) => Response.json({ body: await event.request.text() }),
				}),
				endpoint("/relay", { GET: (event: RequestEvent) => event.fetch("/echo") }),
				endpoint("/loop", { GET: (event: RequestEvent) => event.fetch("/loop") }),
			],
			renderPage: () => null,
			...overrides,
		});
		const call = (path: string, init?: RequestInit) =>
			kit.respond(new Request(`http://localhost${path}`, init));
		/** The event for one request, so a test can drive `event.fetch` directly. */
		const eventFor = async (init?: RequestInit): Promise<RequestEvent> => {
			await call("/echo", init);
			return events.at(-1)!;
		};
		return { kit, call, eventFor, events };
	}

	it("dispatches a same-origin request in-process, with no listener anywhere", async () => {
		const { call, events } = capturing();
		const response = await call("/relay");
		expect(response.status).toBe(200);
		expect((await response.json()) as { url: string }).toMatchObject({
			url: "http://localhost/echo",
		});
		// the nested request went through the whole pipeline, hooks included
		expect(events.map((event) => event.url.pathname)).toEqual(["/relay", "/echo"]);
	});

	it("resolves a relative URL against event.url", async () => {
		const event = await capturing().eventFor();
		const response = await event.fetch("echo?q=1");
		expect(((await response.json()) as { url: string }).url).toBe("http://localhost/echo?q=1");
	});

	it("forwards cookie and authorization, and leaves other headers to the caller", async () => {
		const event = await capturing().eventFor({
			headers: { cookie: "session=1", authorization: "Bearer t", "x-custom": "no" },
		});
		const body = (await (await event.fetch("/echo")).json()) as Record<string, string | null>;
		expect(body["cookie"]).toBe("session=1");
		expect(body["authorization"]).toBe("Bearer t");
		expect(body["custom"]).toBeNull();
	});

	it("lets an explicit header win over the forwarded one", async () => {
		const event = await capturing().eventFor({ headers: { cookie: "session=1" } });
		const response = await event.fetch("/echo", { headers: { cookie: "session=2" } });
		expect(((await response.json()) as Record<string, string>)["cookie"]).toBe("session=2");
	});

	it("carries a request body through", async () => {
		const event = await capturing().eventFor();
		const response = await event.fetch("/echo", { method: "POST", body: "hello" });
		expect((await response.json()) as { body: string }).toEqual({ body: "hello" });
	});

	it("goes out over the network for a cross-origin URL", async () => {
		const calls: string[] = [];
		const real = globalThis.fetch;
		globalThis.fetch = (input: RequestInfo | URL) => {
			calls.push(input instanceof Request ? input.url : String(input));
			return Promise.resolve(new Response("outside"));
		};
		try {
			const event = await capturing().eventFor();
			expect(await (await event.fetch("https://example.com/x")).text()).toBe("outside");
			expect(calls).toEqual(["https://example.com/x"]);
		} finally {
			globalThis.fetch = real;
		}
	});

	it("stops a handler that fetches itself rather than exhausting the stack", async () => {
		const reports: ServerErrorReport[] = [];
		const kit = capturing();
		const response = await kit.kit.respond(new Request("http://localhost/loop"), {
			onError: (report) => reports.push(report),
		});
		expect(response.status).toBe(500);
		const thrown = reports.at(-1)?.error;
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error | undefined)?.message).toContain("fetching a route");
	});

	it("says so on every call when nothing supplied a client", async () => {
		const { api } = await capturing().eventFor();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `App.Api` is empty inside kit itself; the stand-in is what is under test.
		const call = (api as unknown as Record<string, () => unknown>)["GET"];
		expect(call).toBeTypeOf("function");
		expect(() => call?.()).toThrow(/without `createApiClient`/);
	});

	it("binds event.api to the in-process fetch, at the request's own origin", async () => {
		const seen: { fetch?: typeof fetch; baseUrl?: string } = {};
		const event = await capturing({
			createApiClient: (options) => {
				seen.fetch = options.fetch;
				seen.baseUrl = options.baseUrl;
				return {};
			},
		}).eventFor();
		expect(seen.baseUrl).toBe("http://localhost");
		expect(seen.fetch).toBe(event.fetch);
	});
});
