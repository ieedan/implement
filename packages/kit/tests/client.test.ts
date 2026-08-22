/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back stubbed responses requires intentional narrowing. */
import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
	ApiError,
	buildUrl,
	createClient,
	type MethodClient,
	type Operations,
	type PathClient,
	type ThrowWrapper,
	type TypedClient,
} from "../src/client.ts";
import {
	createClient as createResultClient,
	type ResultClient,
	type ResultPathClient,
} from "../src/client-neverthrow.ts";
import { handler } from "../src/endpoint.ts";

const Post = z.object({ id: z.number(), title: z.string() });

/** A stand-in `server.ts` module, so the table is built exactly the way generation builds it. */
const posts = {
	GET: handler({
		query: z.object({ draft: z.stringbool().default(false) }),
		handle: ({ params }) => ({ id: params["id"] ?? "", title: "hello" }),
	}),
	PATCH: handler({
		body: Post.pick({ title: true }),
		response: Post,
		handle: ({ body }) => ({ id: 1, title: body.title }),
	}),
};

declare const plain: (event: never) => Promise<Response>;

type Api = {
	"/api/posts/[id]": { params: { id: string }; operations: Operations<typeof posts> };
	"/docs/[...slug].md": { params: { slug: string }; operations: Operations<{ GET: typeof plain }> };
};

/** A fetch that records what it was asked for and answers with what a test set up. */
function stub(respond: (request: Request) => Response | Promise<Response>) {
	const seen: Request[] = [];
	const call: typeof fetch = async (input, init) => {
		const request = input instanceof Request ? input : new Request(new URL(String(input)), init);
		seen.push(request);
		return await respond(request);
	};
	return { seen, fetch: call };
}

const ORIGIN = "http://api.test";

describe("buildUrl", () => {
	it("substitutes params into the route key", () => {
		expect(buildUrl("/api/posts/[id]", { id: "7" }, undefined)).toBe("/api/posts/7");
	});

	it("keeps a catch-all's slashes as separators and encodes each segment", () => {
		expect(buildUrl("/docs/[...slug].md", { slug: "guide/a b" }, undefined)).toBe(
			"/docs/guide/a%20b.md",
		);
	});

	it("appends the query, skipping nothing-values and repeating arrays", () => {
		expect(buildUrl("/api", undefined, { a: 1, b: [true, false], c: undefined, d: null })).toBe(
			"/api?a=1&b=true&b=false",
		);
	});

	it("prefixes the base url without doubling the slash", () => {
		expect(buildUrl("/api", undefined, undefined, "https://x.test/")).toBe("https://x.test/api");
	});

	it("says which param is missing rather than building a broken URL", () => {
		expect(() => buildUrl("/api/posts/[id]", {}, undefined)).toThrow(/missing route param "id"/);
	});
});

describe('the "result" style', () => {
	it("returns the parsed body, and sends params and query where they belong", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const { data, error, response } = await api.GET("/api/posts/[id]", {
			params: { id: "7" },
			query: { draft: true },
		});
		expect(error).toBeUndefined();
		expect(data).toEqual({ id: "7", title: "hello" });
		expect(response?.status).toBe(200);
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/api/posts/7?draft=true`);
	});

	it("JSON-encodes a body and sets the content type", async () => {
		const stubbed = stub(() => Response.json({ id: 1, title: "hi" }));
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		await api.PATCH("/api/posts/[id]", { params: { id: "1" }, body: { title: "hi" } });
		const sent = stubbed.seen[0]!;
		expect(sent.method).toBe("PATCH");
		expect(sent.headers.get("content-type")).toBe("application/json");
		expect(await sent.text()).toBe('{"title":"hi"}');
	});

	it("sends a raw body as-is", async () => {
		const stubbed = stub(() => new Response(null, { status: 204 }));
		// an untyped shape, since no table declares a form-bodied route
		const api = createClient<{
			POST: (path: string, options: { body: unknown }) => Promise<unknown>;
		}>({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		await api.POST("/api", { body: new URLSearchParams({ a: "1" }) });
		expect(stubbed.seen[0]!.headers.get("content-type")).toContain(
			"application/x-www-form-urlencoded",
		);
	});

	it("turns a non-2xx into an ApiError carrying the app's message", async () => {
		const stubbed = stub(() => Response.json({ message: "no post 7" }, { status: 404 }));
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const { data, error, response } = await api.GET("/api/posts/[id]", { params: { id: "7" } });
		expect(data).toBeUndefined();
		expect(error).toBeInstanceOf(ApiError);
		expect(error?.status).toBe(404);
		expect(error?.message).toBe("no post 7");
		expect(error?.body).toEqual({ message: "no post 7" });
		expect(response?.status).toBe(404);
	});

	it("falls back to the status line when the body says nothing", async () => {
		const stubbed = stub(() => new Response("nope", { status: 503, statusText: "Unavailable" }));
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const { error } = await api.GET("/api/posts/[id]", { params: { id: "7" } });
		expect(error?.message).toBe("503 Unavailable");
	});

	it("turns a request that never reached a server into a status-0 ApiError", async () => {
		const api: TypedClient<Api> = createClient({
			baseUrl: ORIGIN,
			fetch: () => Promise.reject(new TypeError("offline")),
		});
		const { error, response } = await api.GET("/api/posts/[id]", { params: { id: "7" } });
		expect(error?.status).toBe(0);
		expect(error?.message).toBe("request failed");
		expect(response).toBeUndefined();
	});

	it("reads a 204 as no data at all rather than an empty string", async () => {
		const stubbed = stub(() => new Response(null, { status: 204 }));
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const { data, error } = await api.GET("/api/posts/[id]", { params: { id: "7" } });
		expect(error).toBeUndefined();
		expect(data).toBeUndefined();
	});

	it("hands back text for a non-JSON response", async () => {
		const stubbed = stub(
			() => new Response("# hi", { headers: { "content-type": "text/markdown" } }),
		);
		const api: TypedClient<Api> = createClient({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const { data } = await api.GET("/docs/[...slug].md", { params: { slug: "a/b" } });
		expect(data).toBe("# hi");
	});

	it("merges client headers with per-call ones, the call winning", async () => {
		const stubbed = stub(() => Response.json({}));
		const api: TypedClient<Api> = createClient({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			headers: () => ({ authorization: "Bearer base", "x-app": "docs" }),
		});
		await api.GET("/api/posts/[id]", {
			params: { id: "7" },
			headers: { authorization: "Bearer call" },
		});
		const sent = stubbed.seen[0]!;
		expect(sent.headers.get("authorization")).toBe("Bearer call");
		expect(sent.headers.get("x-app")).toBe("docs");
	});
});

describe('the "throw" style', () => {
	it("returns the data directly", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createClient<MethodClient<Api, ThrowWrapper>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			errors: "throw",
		});
		expect(await api.GET("/api/posts/[id]", { params: { id: "7" } })).toEqual({
			id: "7",
			title: "hello",
		});
	});

	it("throws the ApiError", async () => {
		const stubbed = stub(() => Response.json({ message: "gone" }, { status: 410 }));
		const api = createClient<MethodClient<Api, ThrowWrapper>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			errors: "throw",
		});
		await expect(api.GET("/api/posts/[id]", { params: { id: "7" } })).rejects.toThrow("gone");
	});
});

describe('the "path" style', () => {
	it("calls through the route key", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createClient<PathClient<Api>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "path",
		});
		const { data } = await api["/api/posts/[id]"].GET({ params: { id: "7" } });
		expect(data).toEqual({ id: "7", title: "hello" });
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/api/posts/7`);
	});
});

describe('the "neverthrow" style', () => {
	it("chains off the call without awaiting it", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createResultClient<ResultClient<Api>>({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const title = await api
			.GET("/api/posts/[id]", { params: { id: "7" } })
			.map((post) => post.title)
			.unwrapOr("none");
		expect(title).toBe("hello");
	});

	it("carries a failure as the error side of the Result", async () => {
		const stubbed = stub(() => Response.json({ message: "gone" }, { status: 410 }));
		const api = createResultClient<ResultClient<Api>>({ baseUrl: ORIGIN, fetch: stubbed.fetch });
		const result = await api.GET("/api/posts/[id]", { params: { id: "7" } });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) expect(result.error.status).toBe(410);
	});

	it("works in the path style too", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createResultClient<ResultPathClient<Api>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "path",
		});
		const post = await api["/api/posts/[id]"].GET({ params: { id: "7" } }).unwrapOr(null);
		expect(post).toEqual({ id: "7", title: "hello" });
	});
});
