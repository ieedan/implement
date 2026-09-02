/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading JSON-RPC envelopes back out of responses requires intentional narrowing. */
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { error } from "../src/errors.ts";
import { handler } from "../src/endpoint.ts";
import type { EndpointRoute } from "../src/match.ts";
import {
	ASSUMED_PROTOCOL_VERSION,
	JSON_RPC_ERRORS,
	LATEST_PROTOCOL_VERSION,
	mcp,
	SUPPORTED_PROTOCOL_VERSIONS,
	tool,
	type McpOptions,
} from "../src/mcp.ts";
import { createKitServer } from "../src/server.ts";

const endpoint = (pattern: string, module: Record<string, unknown>): EndpointRoute => ({
	pattern,
	id: pattern,
	extension: null,
	file: `${pattern}/server.ts`,
	module,
});

/** The MCP handlers mounted at `/mcp`, dispatched the way a real request is. */
function server(options: McpOptions, extra: EndpointRoute[] = []) {
	const kit = createKitServer({
		hooks: {},
		pages: [],
		endpoints: [endpoint("/mcp", { ...mcp(options) }), ...extra],
		renderPage: () => null,
	});
	return (init?: RequestInit, path = "/mcp") =>
		kit.respond(new Request(`http://localhost${path}`, init));
}

/** The app's own origin, for a request whose content type the CSRF check looks at. */
const LOCAL_ORIGIN = { origin: "http://localhost" };

/** A JSON-RPC request as `fetch` would send it. */
function rpc(body: unknown, headers: Record<string, string> = {}): RequestInit {
	return {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	};
}

function request(method: string, params?: unknown, id: number = 1): unknown {
	return { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) };
}

type RpcEnvelope = {
	jsonrpc: "2.0";
	id: unknown;
	result?: Record<string, unknown>;
	error?: { code: number; message: string };
};

async function envelope(response: Response): Promise<RpcEnvelope> {
	return (await response.json()) as RpcEnvelope;
}

/** A result read back out of JSON: every block's fields optional, whatever its type. */
type CallResult = {
	content: { type: string; text?: string; data?: string; mimeType?: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

/** One `tools/call`, unwrapped to the tool result. */
async function call(
	post: ReturnType<typeof server>,
	name: string,
	args?: unknown,
): Promise<CallResult> {
	const response = await post(rpc(request("tools/call", { name, arguments: args })));
	expect(response.status).toBe(200);
	return (await envelope(response)).result as CallResult;
}

const INFO = { name: "test", version: "1.0.0" };

describe("mcp() transport", () => {
	it("answers initialize in the client's version when it is one we speak", async () => {
		const post = server({ serverInfo: INFO, instructions: "be nice", tools: [] });
		const older = SUPPORTED_PROTOCOL_VERSIONS[1];
		const response = await post(rpc(request("initialize", { protocolVersion: older })));
		const { result } = await envelope(response);
		expect(result).toMatchObject({
			protocolVersion: older,
			capabilities: { tools: { listChanged: false } },
			serverInfo: INFO,
			instructions: "be nice",
		});
	});

	it("answers initialize with the latest version for one it does not speak", async () => {
		const post = server({ serverInfo: INFO, tools: [] });
		const response = await post(rpc(request("initialize", { protocolVersion: "1999-01-01" })));
		const { result } = await envelope(response);
		expect(result?.["protocolVersion"]).toBe(LATEST_PROTOCOL_VERSION);
		// no instructions were configured, so none are claimed
		expect(result !== undefined && "instructions" in result).toBe(false);
	});

	it("assumes a version for a request without the header, and rejects an unsupported one", async () => {
		expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(ASSUMED_PROTOCOL_VERSION);
		const post = server({ serverInfo: INFO, tools: [] });
		expect((await post(rpc(request("ping")))).status).toBe(200);
		const rejected = await post(rpc(request("ping"), { "mcp-protocol-version": "1999-01-01" }));
		expect(rejected.status).toBe(400);
		const { error: fault } = await envelope(rejected);
		expect(fault?.code).toBe(-32600);
		expect(fault?.message).toContain("1999-01-01");
	});

	it("rejects a cross-site web origin, and lets native clients through", async () => {
		const post = server({ serverInfo: INFO, tools: [] });
		const forged = await post(rpc(request("ping"), { origin: "https://evil.example" }));
		expect(forged.status).toBe(403);
		for (const origin of ["http://localhost", "null", "vscode-file://vscode-app"]) {
			expect((await post(rpc(request("ping"), { origin }))).status).toBe(200);
		}
	});

	it("answers 401 with the challenge that tells a client where to authenticate", async () => {
		const post = server({
			serverInfo: INFO,
			tools: [],
			authorize: (event) => event.request.headers.get("authorization") === "Bearer ok",
		});
		// before parsing: an unauthenticated client needs the challenge, not a parse error
		// (`origin` because a bare string body is sent as `text/plain`, which the
		// pipeline's CSRF check gates when it comes from nowhere)
		const denied = await post({ method: "POST", body: "not json", headers: LOCAL_ORIGIN });
		expect(denied.status).toBe(401);
		expect(denied.headers.get("www-authenticate")).toBe(
			'Bearer resource_metadata="http://localhost/.well-known/oauth-protected-resource"',
		);
		const allowed = await post(rpc(request("ping"), { authorization: "Bearer ok" }));
		expect(allowed.status).toBe(200);
	});

	it("names the metadata document the app chose", async () => {
		const post = server({
			serverInfo: INFO,
			tools: [],
			authorize: () => false,
			resourceMetadata: "/.well-known/oauth-protected-resource/mcp",
		});
		const denied = await post(rpc(request("ping")));
		expect(denied.headers.get("www-authenticate")).toContain(
			"http://localhost/.well-known/oauth-protected-resource/mcp",
		);
	});

	it("answers protocol faults as JSON-RPC errors", async () => {
		const post = server({ serverInfo: INFO, tools: [] });

		const unparseable = await post({ method: "POST", body: "not json", headers: LOCAL_ORIGIN });
		expect(unparseable.status).toBe(400);
		expect((await envelope(unparseable)).error?.code).toBe(-32700);

		const batched = await post(rpc([request("ping")]));
		expect(batched.status).toBe(400);
		expect((await envelope(batched)).error?.code).toBe(-32600);

		const unknown = await post(rpc(request("resources/list", undefined, 7)));
		const fault = await envelope(unknown);
		expect(fault.id).toBe(7);
		expect(fault.error?.code).toBe(-32601);
	});

	it("answers a notification with a bare 202", async () => {
		const post = server({ serverInfo: INFO, tools: [] });
		const response = await post(rpc({ jsonrpc: "2.0", method: "notifications/initialized" }));
		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});

	it("has no GET stream and no session to DELETE", async () => {
		const post = server({ serverInfo: INFO, tools: [] });
		for (const method of ["GET", "DELETE"]) {
			const response = await post({ method });
			expect(response.status).toBe(405);
			expect(response.headers.get("allow")).toBe("POST");
		}
	});

	it("refuses two tools wearing the same name", () => {
		const twin = { name: "twin", description: "either one", handle: () => null };
		expect(() => mcp({ serverInfo: INFO, tools: [twin, { ...twin }] })).toThrow("twin");
	});
});

describe("tools", () => {
	const echo = tool({
		name: "echo",
		description: "Says the id back.",
		input: v.object({ id: v.pipe(v.string(), v.minLength(1)) }),
		annotations: { readOnlyHint: true },
		handle: ({ input }) => ({ echoed: input.id }),
	});

	it("lists a tool with its schema converted, the way the OpenAPI document converts it", async () => {
		const bare = tool({ name: "bare", description: "No input at all.", handle: () => "ok" });
		const post = server({ serverInfo: INFO, tools: [echo, bare] });
		const { result } = await envelope(await post(rpc(request("tools/list"))));
		const tools = result?.["tools"] as Record<string, unknown>[];
		expect(tools.map((entry) => entry["name"])).toEqual(["echo", "bare"]);
		expect(tools[0]).toMatchObject({
			description: "Says the id back.",
			annotations: { readOnlyHint: true },
			inputSchema: { type: "object", properties: { id: { type: "string" } } },
		});
		expect(tools[1]?.["inputSchema"]).toEqual({ type: "object", properties: {} });
	});

	/** A schema claiming a vendor whose converter will not know what to do with it. */
	const broken = {
		"~standard": {
			version: 1 as const,
			vendor: "zod",
			validate: (value: unknown) => ({ value }),
		},
	};

	/** One whose vendor kit has no converter for at all. */
	const foreign = { ...broken, "~standard": { ...broken["~standard"], vendor: "homegrown" } };

	it("fails tools/list loudly when a schema will not convert, rather than serving it empty", async () => {
		const post = server({
			serverInfo: INFO,
			tools: [echo, tool({ ...echo, name: "bad", input: broken })],
		});
		const { result, error } = await envelope(await post(rpc(request("tools/list"))));
		expect(result).toBeUndefined();
		expect(error?.code).toBe(JSON_RPC_ERRORS.internalError);
		expect(error?.message).toContain('tool "bad"');
		expect(error?.message).toContain("inputJsonSchema");
	});

	it("fails a call the same way, since it reads the same schemas", async () => {
		const post = server({
			serverInfo: INFO,
			tools: [tool({ ...echo, name: "bad", input: broken })],
		});
		const { error } = await envelope(
			await post(rpc(request("tools/call", { name: "bad", arguments: { id: "7" } }))),
		);
		expect(error?.code).toBe(JSON_RPC_ERRORS.internalError);
		expect(error?.message).toContain('tool "bad"');
	});

	it("still degrades a vendor kit has no converter for, which no build can fix", async () => {
		const warnings: string[] = [];
		const warn = vi.spyOn(console, "warn").mockImplementation((message: string) => {
			warnings.push(message);
		});
		try {
			const post = server({
				serverInfo: INFO,
				tools: [tool({ ...echo, name: "odd", input: foreign })],
			});
			const { result } = await envelope(await post(rpc(request("tools/list"))));
			const tools = result?.["tools"] as Record<string, unknown>[];
			expect(tools[0]?.["inputSchema"]).toEqual({ type: "object" });
			expect(warnings.join("\n")).toContain("homegrown");
			expect(warnings.join("\n")).toContain("inputJsonSchema");
		} finally {
			warn.mockRestore();
		}
	});

	it("answers a call with the result as JSON, and a returned string as itself", async () => {
		const shout = tool({ name: "shout", description: "A string.", handle: () => "loud" });
		const post = server({ serverInfo: INFO, tools: [echo, shout] });
		expect(await call(post, "echo", { id: "7" })).toEqual({
			content: [{ type: "text", text: '{"echoed":"7"}' }],
		});
		expect(await call(post, "shout")).toEqual({ content: [{ type: "text", text: "loud" }] });
	});

	it("answers what the model can act on as failed results, not protocol errors", async () => {
		const post = server({ serverInfo: INFO, tools: [echo] });

		const unknown = await call(post, "nope");
		expect(unknown.isError).toBe(true);
		expect(unknown.content[0]?.text).toContain("nope");

		// the schema's issues, so the model corrects the call instead of guessing
		const invalid = await call(post, "echo", { id: "" });
		expect(invalid.isError).toBe(true);
		expect(invalid.content[0]?.text).toContain("id");
	});

	it("reads a thrown error() like an endpoint's, and a tool.failure() as itself", async () => {
		const missing = tool({
			name: "missing",
			description: "Always a 404.",
			handle: () => error(404, "no such thing"),
		});
		const taken = tool({
			name: "taken",
			description: "An expected failure.",
			handle: () => tool.failure("that name is taken"),
		});
		const broken = tool({
			name: "broken",
			description: "An unexpected failure.",
			handle: () => {
				throw new Error("boom");
			},
		});
		const post = server({ serverInfo: INFO, tools: [missing, taken, broken] });
		expect((await call(post, "missing")).content[0]?.text).toBe("no such thing (HTTP 404)");
		expect(await call(post, "taken")).toEqual({
			content: [{ type: "text", text: "that name is taken" }],
			isError: true,
		});
		expect((await call(post, "broken")).content[0]?.text).toBe("boom");
	});

	it("answers with image and audio blocks, encoding bytes as the protocol's base64", async () => {
		// a one-pixel GIF, as bytes the way a tool would have read them off disk
		const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		const screenshot = tool({
			name: "screenshot",
			description: "An image.",
			handle: () => tool.image(bytes, "image/gif"),
		});
		const recording = tool({
			name: "recording",
			description: "Audio, already base64.",
			handle: () => tool.audio("QUJD", "audio/wav"),
		});
		const attachment = tool({
			name: "attachment",
			description: "A caption and the file it describes.",
			handle: () =>
				tool.content(
					{ type: "text", text: "logo.gif" },
					{ type: "image", data: bytes.buffer, mimeType: "image/gif" },
				),
		});
		const post = server({ serverInfo: INFO, tools: [screenshot, recording, attachment] });

		expect(await call(post, "screenshot")).toEqual({
			content: [{ type: "image", data: "R0lGODlh", mimeType: "image/gif" }],
		});
		expect(await call(post, "recording")).toEqual({
			content: [{ type: "audio", data: "QUJD", mimeType: "audio/wav" }],
		});
		expect(await call(post, "attachment")).toEqual({
			content: [
				{ type: "text", text: "logo.gif" },
				{ type: "image", data: "R0lGODlh", mimeType: "image/gif" },
			],
		});
	});

	it("encodes bytes too large to spread in one call", async () => {
		const bytes = new Uint8Array(200_000).fill(0x41);
		const big = tool({
			name: "big",
			description: "A large file.",
			handle: () => tool.image(bytes, "application/octet-stream"),
		});
		const post = server({ serverInfo: INFO, tools: [big] });
		const result = await call(post, "big");
		expect(result.content[0]?.data).toBe(btoa("A".repeat(200_000)));
	});

	it("carries structuredContent, with the JSON as text for a client that reads only content", async () => {
		const stats = tool({
			name: "stats",
			description: "Data as data.",
			handle: () => tool.structured({ open: 3 }),
		});
		const captioned = tool({
			name: "captioned",
			description: "Data, said differently in text.",
			handle: () => tool.structured({ open: 3 }, { type: "text", text: "3 open issues" }),
		});
		const post = server({ serverInfo: INFO, tools: [stats, captioned] });

		expect(await call(post, "stats")).toEqual({
			content: [{ type: "text", text: '{"open":3}' }],
			structuredContent: { open: 3 },
		});
		expect(await call(post, "captioned")).toEqual({
			content: [{ type: "text", text: "3 open issues" }],
			structuredContent: { open: 3 },
		});
	});

	it("hands handle the schema's output, and the route's own event", async () => {
		const upper = tool({
			name: "upper",
			description: "Uppercases through the schema.",
			input: v.object({
				word: v.pipe(
					v.string(),
					v.transform((value) => value.toUpperCase()),
				),
			}),
			handle: ({ input, event }) => `${input.word} via ${event.url.pathname}`,
		});
		const post = server({ serverInfo: INFO, tools: [upper] });
		expect((await call(post, "upper", { word: "quiet" })).content[0]?.text).toBe("QUIET via /mcp");
	});
});

describe("tool.fromEndpoint", () => {
	const PATCH = handler({
		params: v.object({ id: v.pipe(v.string(), v.transform(Number)) }),
		query: v.object({
			draft: v.optional(
				v.pipe(
					v.string(),
					v.transform((value) => value === "true"),
				),
				"false",
			),
		}),
		body: v.object({ title: v.pipe(v.string(), v.minLength(1)) }),
		handle: ({ params, query, body }) => ({ id: params.id, draft: query.draft, ...body }),
	});

	const patchPost = tool.fromEndpoint(PATCH, {
		name: "update_post",
		description: "Rename one post.",
		path: "/api/posts/[id]",
	});

	it("describes its input as the envelope of what the handler declares", async () => {
		const post = server({ serverInfo: INFO, tools: [patchPost] });
		const { result } = await envelope(await post(rpc(request("tools/list"))));
		const tools = (result?.["tools"] ?? []) as Record<string, unknown>[];
		const described = tools[0];
		expect(described?.["inputSchema"]).toMatchObject({
			type: "object",
			required: ["params", "body"],
			properties: {
				params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
				query: { type: "object" },
				body: {
					type: "object",
					required: ["title"],
					properties: { title: { type: "string" } },
				},
			},
		});
	});

	it("dispatches through the handler, validation and all", async () => {
		const post = server({ serverInfo: INFO, tools: [patchPost] });
		const updated = await call(post, "update_post", {
			params: { id: "7" },
			query: { draft: "true" },
			body: { title: "renamed" },
		});
		expect(updated).toEqual({
			content: [{ type: "text", text: '{"id":7,"draft":true,"title":"renamed"}' }],
		});

		// the handler's own 400, read back as a failed result the model can fix
		const rejected = await call(post, "update_post", {
			params: { id: "7" },
			body: { title: "" },
		});
		expect(rejected.isError).toBe(true);
		expect(rejected.content[0]?.text).toContain("title");
		expect(rejected.content[0]?.text).toContain("HTTP 400");
	});

	it("fails a call that leaves a path param unfilled", async () => {
		const post = server({ serverInfo: INFO, tools: [patchPost] });
		const unfilled = await call(post, "update_post", { body: { title: "renamed" } });
		expect(unfilled.isError).toBe(true);
		expect(unfilled.content[0]?.text).toContain("path param");
	});
});

describe("arguments a model sent as text", () => {
	const updateIssue = tool({
		name: "update_issue",
		description: "Change one issue.",
		input: v.object({
			id: v.string(),
			changes: v.object({
				status: v.optional(v.string()),
				labels: v.optional(v.array(v.string())),
				priority: v.optional(v.number()),
				pinned: v.optional(v.boolean()),
			}),
		}),
		handle: ({ input }) => input,
	});

	const post = server({ serverInfo: INFO, tools: [updateIssue] });

	it("reads a structure the model spelled as JSON text", async () => {
		const updated = await call(post, "update_issue", {
			id: "ENG-27",
			changes: '{"status":"in_progress","labels":["bug"]}',
		});
		expect(updated.isError).toBeUndefined();
		expect(JSON.parse(updated.content[0]?.text ?? "null")).toEqual({
			id: "ENG-27",
			changes: { status: "in_progress", labels: ["bug"] },
		});
	});

	it("reaches values nested inside a structure that arrived correctly", async () => {
		const updated = await call(post, "update_issue", {
			id: "ENG-27",
			changes: { status: "done", labels: '["bug","ui"]', priority: "2", pinned: "true" },
		});
		expect(JSON.parse(updated.content[0]?.text ?? "null")).toEqual({
			id: "ENG-27",
			changes: { status: "done", labels: ["bug", "ui"], priority: 2, pinned: true },
		});
	});

	it("reads the whole envelope when that is what was stringified", async () => {
		const updated = await call(
			post,
			"update_issue",
			JSON.stringify({ id: "ENG-27", changes: { status: "done" } }),
		);
		expect(JSON.parse(updated.content[0]?.text ?? "null")).toEqual({
			id: "ENG-27",
			changes: { status: "done" },
		});
	});

	it("leaves a string where the schema takes one, however much it looks like JSON", async () => {
		const comment = tool({
			name: "comment",
			description: "Adds a comment.",
			input: v.object({
				body: v.string(),
				// a field that genuinely accepts either spelling keeps the caller's
				meta: v.union([v.string(), v.object({ kind: v.string() })]),
			}),
			handle: ({ input }) => input,
		});
		const commenting = server({ serverInfo: INFO, tools: [comment] });
		const added = await call(commenting, "comment", {
			body: '{"not":"an object"}',
			meta: '{"kind":"note"}',
		});
		expect(JSON.parse(added.content[0]?.text ?? "null")).toEqual({
			body: '{"not":"an object"}',
			meta: '{"kind":"note"}',
		});
	});

	it("leaves text the schema cannot hold for the schema to reject", async () => {
		// parses, but to the wrong kind — the string stays, and the message is
		// the schema's own rather than a parse error the model cannot act on
		const wrongKind = await call(post, "update_issue", { id: "ENG-27", changes: "[1,2]" });
		expect(wrongKind.isError).toBe(true);
		expect(wrongKind.content[0]?.text).toContain("changes");

		const notJson = await call(post, "update_issue", { id: "ENG-27", changes: "in_progress" });
		expect(notJson.isError).toBe(true);
		expect(notJson.content[0]?.text).toContain("changes");
	});

	it("follows a $ref, including one that points at itself", async () => {
		const node = z.object({
			name: z.string(),
			get child() {
				return z.optional(node);
			},
		});
		const plant = tool({
			name: "plant",
			description: "Plants a tree.",
			input: z.object({ tree: node }),
			handle: ({ input }) => input,
		});
		const planting = server({ serverInfo: INFO, tools: [plant] });

		// `tree` is a `$ref` into `$defs`, and `child` refs the same definition
		const planted = await call(planting, "plant", {
			tree: { name: "root", child: '{"name":"leaf"}' },
		});
		expect(JSON.parse(planted.content[0]?.text ?? "null")).toEqual({
			tree: { name: "root", child: { name: "leaf" } },
		});
	});

	it("reads a stringified part of an endpoint tool's envelope", async () => {
		const PUT = handler({
			params: v.object({ id: v.string() }),
			body: v.object({ title: v.string() }),
			handle: ({ params, body }) => ({ id: params.id, ...body }),
		});
		const rename = tool.fromEndpoint(PUT, {
			name: "rename_post",
			description: "Rename one post.",
			path: "/api/posts/[id]",
		});
		const renaming = server({ serverInfo: INFO, tools: [rename] });
		const renamed = await call(renaming, "rename_post", {
			params: '{"id":"7"}',
			body: '{"title":"renamed"}',
		});
		expect(renamed).toEqual({
			content: [{ type: "text", text: '{"id":"7","title":"renamed"}' }],
		});
	});
});
