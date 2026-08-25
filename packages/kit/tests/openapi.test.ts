/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back the documents these tests build requires intentional narrowing. */
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { handler } from "../src/endpoint.ts";
import {
	buildOpenApiDocument,
	openApiEndpoint,
	openApiPath,
	operationId,
	type OpenApiEndpoint,
} from "../src/openapi.ts";
import { matcher, mismatch, type AnyParamMatcher } from "../src/params.ts";

const INFO = { title: "Docs API", version: "1.0.0" };

const Post = v.object({ id: v.number(), title: v.string() });

const posts: OpenApiEndpoint = {
	key: "/api/posts/[id]",
	params: [{ name: "id", matcher: null }],
	file: "api/posts/[id]/server.ts",
	module: {
		GET: handler({
			query: v.object({ draft: v.optional(v.string()), tag: v.string() }),
			handle: () => ({ ok: true }),
		}),
		PATCH: handler({
			params: v.object({ id: v.string() }),
			body: v.pick(Post, ["title"]),
			response: Post,
			handle: () => ({ id: 1, title: "x" }),
		}),
	},
};

const plain: OpenApiEndpoint = {
	key: "/search.json",
	params: [],
	file: "search/.json/server.ts",
	module: { GET: () => new Response("[]") },
};

/** One operation of a built document, without the ceremony of walking `paths` by hand. */
async function operation(endpoints: OpenApiEndpoint[], path: string, method: string) {
	const { document, warnings } = await buildOpenApiDocument(endpoints, { info: INFO });
	expect(warnings).toEqual([]);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this test just built.
	return document.paths[path]?.[method] as Record<string, unknown> | undefined;
}

describe("openApiPath", () => {
	it("turns route params into OpenAPI templates", () => {
		expect(openApiPath("/api/posts/[id]")).toBe("/api/posts/{id}");
		expect(openApiPath("/docs/[...slug].md")).toBe("/docs/{slug}.md");
	});

	it("leaves a param matcher out of the template", () => {
		// the template names a parameter, and the parameter is named `number` —
		// `{number=integer}` is one no document declares
		expect(openApiPath("/api/items/[number=integer]")).toBe("/api/items/{number}");
		expect(openApiPath("/docs/[...slug=path].md")).toBe("/docs/{slug}.md");
	});
});

describe("operationId", () => {
	it("names an operation from its method and route", () => {
		expect(operationId("GET", "/api/posts/[id]")).toBe("getApiPostsById");
		expect(operationId("GET", "/search.json")).toBe("getSearchJson");
		expect(operationId("GET", "/")).toBe("get");
	});

	it("names it after the param, not after the matcher gating it", () => {
		expect(operationId("GET", "/api/items/[number=integer]")).toBe("getApiItemsByNumber");
	});
});

describe("buildOpenApiDocument", () => {
	it("documents a route's path and query params from its schemas", async () => {
		const get = await operation([posts], "/api/posts/{id}", "get");
		expect(get?.["operationId"]).toBe("getApiPostsById");
		expect(get?.["parameters"]).toEqual([
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
			{ name: "draft", in: "query", required: false, schema: { type: "string" } },
			{ name: "tag", in: "query", required: true, schema: { type: "string" } },
		]);
	});

	it("documents a request body and a declared response", async () => {
		const patch = await operation([posts], "/api/posts/{id}", "patch");
		expect(patch?.["requestBody"]).toEqual({
			required: true,
			content: {
				"application/json": {
					schema: {
						$schema: "http://json-schema.org/draft-07/schema#",
						type: "object",
						properties: { title: { type: "string" } },
						required: ["title"],
					},
				},
			},
		});
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this test just built.
		const responses = patch?.["responses"] as Record<string, { content: unknown }>;
		expect(responses["200"]).toMatchObject({
			content: {
				"application/json": {
					schema: { properties: { id: { type: "number" }, title: { type: "string" } } },
				},
			},
		});
		// something validates, so a 400 is part of the contract
		expect(responses["400"]).toEqual({ description: "the request failed validation" });
	});

	it("lists a plain handler as a path and a method with nothing constrained", async () => {
		const get = await operation([plain], "/search.json", "get");
		expect(get).toEqual({
			operationId: "getSearchJson",
			parameters: [],
			responses: { "200": { description: "OK", content: { "application/json": { schema: {} } } } },
		});
	});

	it("skips a route that opted out", async () => {
		const { document } = await buildOpenApiDocument(
			[plain, { ...posts, module: { ...posts.module, openapi: false } }],
			{ info: INFO },
		);
		expect(Object.keys(document.paths)).toEqual(["/search.json"]);
	});

	it("carries info and servers straight through", async () => {
		const { document } = await buildOpenApiDocument([], {
			info: INFO,
			servers: [{ url: "https://docs.test" }],
		});
		expect(document).toEqual({
			openapi: "3.1.0",
			info: INFO,
			servers: [{ url: "https://docs.test" }],
			paths: {},
		});
	});

	it("warns and documents an unconstrained schema for a vendor it does not know", async () => {
		const foreign = {
			"~standard": {
				version: 1 as const,
				vendor: "homegrown",
				validate: (value: unknown) => ({ value }),
			},
		};
		const { document, warnings } = await buildOpenApiDocument(
			[{ ...plain, module: { POST: handler({ body: foreign, handle: () => ({ ok: true }) }) } }],
			{ info: INFO },
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("homegrown");
		expect(warnings[0]).toContain("search/.json/server.ts");
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this test just built.
		const post = document.paths["/search.json"]!["post"] as { requestBody: unknown };
		expect(post.requestBody).toEqual({
			required: true,
			content: { "application/json": { schema: {} } },
		});
	});

	it("converts a valibot schema through the vendor's own package", async () => {
		const search: OpenApiEndpoint = {
			key: "/search.json",
			params: [],
			file: "search/.json/server.ts",
			module: {
				GET: handler({
					query: v.object({ area: v.optional(v.picklist(["kit", "ui"])) }),
					handle: () => [],
				}),
			},
		};
		const get = await operation([search], "/search.json", "get");
		expect(get?.["parameters"]).toEqual([
			{
				name: "area",
				in: "query",
				required: false,
				schema: { type: "string", enum: ["kit", "ui"] },
			},
		]);
	});

	// kit converts per vendor, so every vendor it knows needs its own case even
	// though the documentation and these tests are written in valibot
	it("converts a zod schema through the vendor's own package", async () => {
		const search: OpenApiEndpoint = {
			key: "/search.json",
			params: [],
			file: "search/.json/server.ts",
			module: {
				GET: handler({
					query: z.object({ area: z.enum(["kit", "ui"]).optional() }),
					handle: () => [],
				}),
			},
		};
		const get = await operation([search], "/search.json", "get");
		expect(get?.["parameters"]).toEqual([
			{
				name: "area",
				in: "query",
				required: false,
				schema: { type: "string", enum: ["kit", "ui"] },
			},
		]);
	});

	it("uses a caller's own converter when it has one", async () => {
		const { document } = await buildOpenApiDocument([posts], {
			info: INFO,
			toJsonSchema: (_, io) => ({ "x-io": io }),
		});
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this test just built.
		const patch = document.paths["/api/posts/{id}"]!["patch"] as {
			requestBody: { content: Record<string, { schema: unknown }> };
		};
		expect(patch.requestBody.content["application/json"]!.schema).toEqual({ "x-io": "input" });
	});
});

/** The matcher from the issue: it parses the segment rather than only accepting it. */
function parses(value: string) {
	return /^\d+$/.test(value) ? Number(value) : mismatch;
}

/** The `[number=integer]` route, over whatever module it serves with. */
function items(module: Record<string, unknown>): OpenApiEndpoint {
	return {
		key: "/api/items/[number=integer]",
		params: [{ name: "number", matcher: "integer" }],
		file: "api/items/[number=integer]/server.ts",
		module,
	};
}

describe("a param matcher's parameter", () => {
	/** The path parameters of the `GET` this endpoint documents, matchers in hand. */
	async function pathParams(endpoint: OpenApiEndpoint, integer: AnyParamMatcher) {
		const { document, warnings } = await buildOpenApiDocument(
			[endpoint],
			{ info: INFO },
			{
				integer,
			},
		);
		expect(warnings).toEqual([]);
		// the template is the fixed one: `{number=integer}` names a parameter that
		// is not there
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this test just built.
		const get = document.paths["/api/items/{number}"]?.["get"] as Record<string, unknown>;
		return get["parameters"];
	}

	it("documents what the matcher declares it produces", async () => {
		const integer = matcher(parses, { schema: v.pipe(v.number(), v.integer()) });
		expect(await pathParams(items({ GET: handler({ handle: () => [] }) }), integer)).toEqual([
			{ name: "number", in: "path", required: true, schema: { type: "integer" } },
		]);
	});

	it("reads a matcher built from a schema without it being declared twice", async () => {
		const integer = matcher(v.pipe(v.string(), v.transform(Number), v.number()));
		expect(await pathParams(items({ GET: handler({ handle: () => [] }) }), integer)).toEqual([
			{ name: "number", in: "path", required: true, schema: { type: "number" } },
		]);
	});

	it("leaves a matcher with nothing to say the string it arrived as", async () => {
		expect(await pathParams(items({ GET: handler({ handle: () => [] }) }), matcher(/\d+/))).toEqual(
			[{ name: "number", in: "path", required: true, schema: { type: "string" } }],
		);
	});

	it("lets the handler's own params schema win", async () => {
		const integer = matcher(parses, { schema: v.pipe(v.number(), v.integer()) });
		const GET = handler({ params: v.object({ number: v.string() }), handle: () => [] });
		expect(await pathParams(items({ GET }), integer)).toEqual([
			{ name: "number", in: "path", required: true, schema: { type: "string" } },
		]);
	});

	it("warns when two routes reach one path template", async () => {
		const module = { GET: handler({ handle: () => [] }) };
		const { document, warnings } = await buildOpenApiDocument(
			[
				items(module),
				{
					key: "/api/items/[number=uuid]",
					params: [{ name: "number", matcher: "uuid" }],
					file: "api/items/[number=uuid]/server.ts",
					module,
				},
			],
			{ info: INFO },
		);
		expect(Object.keys(document.paths)).toEqual(["/api/items/{number}"]);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("api/items/[number=uuid]/server.ts");
		expect(warnings[0]).toContain("already documented");
	});
});

describe("openApiEndpoint", () => {
	it("serves the document from the route table it was given", async () => {
		const route = openApiEndpoint({
			path: "/openapi.json",
			options: { info: INFO },
			endpoints: [plain],
		});
		expect(route.pattern).toBe("/openapi.json");
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The endpoint module is built right here, with a GET handler.
		const GET = route.module["GET"] as (event: never) => Promise<Response>;
		const response = await GET(undefined as never);
		expect(response.headers.get("content-type")).toContain("application/json");
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document this handler just built.
		const document = (await response.json()) as { paths: Record<string, unknown> };
		expect(Object.keys(document.paths)).toEqual(["/search.json"]);
	});
});
