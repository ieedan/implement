/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back JSON bodies and breaking a schema on purpose require intentional narrowing. */
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { handler, handlerDefinition, parseQuery } from "../src/endpoint.ts";
import type { EndpointRoute, RequestEvent } from "../src/match.ts";
import { createKitServer, type ServerHooks } from "../src/server.ts";

const endpoint = (pattern: string, module: Record<string, unknown>): EndpointRoute => ({
	pattern,
	id: pattern,
	extension: null,
	file: `${pattern}/server.ts`,
	module,
});

const Post = z.object({ id: z.number(), title: z.string() });

/** A server over the handlers under test, dispatched the way a real request is. */
function server(endpoints: EndpointRoute[], hooks: ServerHooks = {}) {
	const kit = createKitServer({
		hooks,
		pages: [],
		endpoints,
		renderPage: () => null,
	});
	return (path: string, init?: RequestInit) =>
		kit.respond(new Request(`http://localhost${path}`, init));
}

const json = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(body),
});

describe("parseQuery", () => {
	it("gives one value per key and an array where a key repeats", () => {
		const url = new URL("http://localhost/?a=1&a=2&b=3");
		expect(parseQuery(url)).toEqual({ a: ["1", "2"], b: "3" });
	});
});

describe("handler()", () => {
	it("returns a plain function, so nothing downstream has to know it exists", async () => {
		const GET = handler({ handle: () => ({ ok: true }) });
		expect(typeof GET).toBe("function");
		const get = server([endpoint("/api", { GET })]);
		expect((await get("/api")).status).toBe(200);
		// still computes Allow from the module's method names
		const other = await get("/api", { method: "DELETE" });
		expect(other.status).toBe(405);
		expect(other.headers.get("allow")).toBe("GET");
	});

	it("JSON-serializes whatever handle returns", async () => {
		const get = server([endpoint("/api", { GET: handler({ handle: () => ({ ok: true }) }) })]);
		const response = await get("/api");
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toEqual({ ok: true });
	});

	it("passes a returned Response straight through", async () => {
		const GET = handler({ handle: () => new Response("raw", { status: 201 }) });
		const response = await server([endpoint("/api", { GET })])("/api");
		expect(response.status).toBe(201);
		expect(await response.text()).toBe("raw");
	});

	it("answers a handler that returned nothing with a 204", async () => {
		const DELETE = handler({ handle: () => undefined });
		const response = await server([endpoint("/api", { DELETE })])("/api", { method: "DELETE" });
		expect(response.status).toBe(204);
	});

	it("validates query and hands the output to handle", async () => {
		const GET = handler({
			query: z.object({ draft: z.stringbool().default(false), tags: z.array(z.string()) }),
			handle: ({ query }) => ({ draft: query.draft, tags: query.tags }),
		});
		const get = server([endpoint("/api", { GET })]);
		expect(await (await get("/api?tags=a&tags=b")).json()).toEqual({
			draft: false,
			tags: ["a", "b"],
		});
		expect(await (await get("/api?draft=true&tags=a&tags=b")).json()).toEqual({
			draft: true,
			tags: ["a", "b"],
		});
	});

	it("400s an invalid query with the issues in the message", async () => {
		const GET = handler({
			query: z.object({ page: z.coerce.number().int() }),
			handle: ({ query }) => query,
		});
		const response = await server([endpoint("/api", { GET })])("/api?page=nope");
		expect(response.status).toBe(400);
		const body = (await response.json()) as { message: string };
		expect(body.message).toContain("invalid query");
		expect(body.message).toContain("page:");
	});

	it("coerces params through a params schema", async () => {
		const GET = handler({
			params: z.object({ id: z.coerce.number() }),
			handle: ({ params }) => ({ id: params.id, type: typeof params.id }),
		});
		const get = server([endpoint("/posts/:id", { GET })]);
		expect(await (await get("/posts/42")).json()).toEqual({ id: 42, type: "number" });
		expect((await get("/posts/abc")).status).toBe(400);
	});

	it("parses and validates a JSON body", async () => {
		const POST = handler({
			body: Post.pick({ title: true }),
			handle: ({ body }) => ({ title: body.title.toUpperCase() }),
		});
		const post = server([endpoint("/posts", { POST })]);
		expect(await (await post("/posts", json({ title: "hi" }))).json()).toEqual({ title: "HI" });
		const bad = await post("/posts", json({ title: 3 }));
		expect(bad.status).toBe(400);
		expect(((await bad.json()) as { message: string }).message).toContain("invalid body");
	});

	it("400s a body that is not the JSON it claims to be", async () => {
		const POST = handler({ body: z.object({}), handle: () => ({ ok: true }) });
		const response = await server([endpoint("/posts", { POST })])("/posts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{oops",
		});
		expect(response.status).toBe(400);
		expect(((await response.json()) as { message: string }).message).toContain("valid JSON");
	});

	it("flattens a form body to an object", async () => {
		const form = new URLSearchParams({ title: "hi" });
		form.append("tag", "a");
		form.append("tag", "b");
		const POST = handler({
			body: z.object({ title: z.string(), tag: z.array(z.string()) }),
			handle: ({ body }) => body,
		});
		const response = await server([endpoint("/posts", { POST })])("/posts", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: form.toString(),
		});
		expect(await response.json()).toEqual({ title: "hi", tag: ["a", "b"] });
	});

	it("validates the response and 500s a handler that breaks its own schema", async () => {
		const GET = handler({
			response: Post,
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately breaking the response schema.
			handle: () => ({ id: 1, title: 2 }) as unknown as z.infer<typeof Post>,
		});
		const response = await server([endpoint("/api", { GET })])("/api");
		expect(response.status).toBe(500);
	});

	it("skips response validation when the handler turns it off", async () => {
		const GET = handler({
			response: Post,
			validateResponse: false,
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deliberately breaking the response schema.
			handle: () => ({ id: 1, title: 2 }) as unknown as z.infer<typeof Post>,
		});
		const response = await server([endpoint("/api", { GET })])("/api");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: 1, title: 2 });
	});

	it("throws validation failures as HttpErrors, so hooks.server.ts sees them", async () => {
		const seen: unknown[] = [];
		const GET = handler({ query: z.object({ page: z.string() }), handle: () => ({ ok: true }) });
		const get = server([endpoint("/api", { GET })], {
			handleError: ({ error: thrown }) => {
				seen.push(thrown);
				return { message: "boom" };
			},
		});
		expect((await get("/api")).status).toBe(400);
		// an expected error never reaches handleError
		expect(seen).toEqual([]);
	});

	it("keeps event.locals and the rest of the request event", async () => {
		const GET = handler({
			handle: (event) => ({
				locals: event.locals,
				route: event.route.id,
				method: event.request.method,
			}),
		});
		const get = server([endpoint("/api", { GET })], {
			handle: ({ event, resolve }) => {
				(event.locals as { user?: string }).user = "ada";
				return resolve(event);
			},
		});
		expect(await (await get("/api")).json()).toEqual({
			locals: { user: "ada" },
			route: "/api",
			method: "GET",
		});
	});
});

describe("handlerDefinition", () => {
	it("exposes the schemas a handler was built with, and nothing for a plain one", () => {
		const query = z.object({ page: z.string() });
		const GET = handler({ query, handle: () => ({ ok: true }) });
		expect(handlerDefinition(GET)?.query).toBe(query);
		expect(handlerDefinition(() => new Response(null))).toBeNull();
		expect(handlerDefinition(undefined)).toBeNull();
	});
});

/** `event.params` is typed from the route, so this only has to compile. */
export const typeChecks = (): void => {
	const GET = handler({
		query: z.object({ draft: z.stringbool().default(false) }),
		handle: ({ params, query }: { params: Record<string, string>; query: { draft: boolean } }) => ({
			id: params["id"],
			draft: query.draft,
		}),
	});
	const event = {} as RequestEvent;
	void GET(event);
};
