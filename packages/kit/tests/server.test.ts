import { describe, expect, it, vi } from "vitest";
import type { EndpointRoute, PageRoute, RequestEvent } from "../src/match.ts";
import {
	createKitServer,
	error,
	redirect,
	sequence,
	type Handle,
	type KitServerOptions,
	type ServerHooks,
} from "../src/server.ts";

type Locals = { user?: string };

const localsOf = (event: RequestEvent): Locals => event.locals as Locals;

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
				{ id: "loaded/index.server.ts", load: (event) => ({ user: localsOf(event).user ?? null }) },
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
		expect(await data.json()).toEqual({ "loaded/index.server.ts": { user: null } });

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
			"loaded/index.server.ts": { user: "ada" },
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

describe("sequence", () => {
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
							id: "loaded/index.server.ts",
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
