/**
 * An MCP server as a route: `mcp()` turns a set of tools into the `POST`,
 * `GET`, and `DELETE` handlers a `server.ts` re-exports, and `tool()` declares
 * one tool the way `handler()` declares one endpoint — a Standard Schema for
 * the input, a function for the work.
 *
 * ```ts
 * // src/routes/mcp/server.ts
 * import * as v from "valibot";
 * import { mcp, tool } from "@implementjs/kit/mcp";
 *
 * const getPost = tool({
 * 	name: "get_post",
 * 	description: "Fetch one post by its id.",
 * 	input: v.object({ id: v.string() }),
 * 	handle: async ({ input }) => await db.post(input.id),
 * });
 *
 * export const { POST, GET, DELETE } = mcp({
 * 	serverInfo: { name: "blog", version: "1.0.0" },
 * 	tools: [getPost],
 * 	authorize: (event) => event.locals.user !== null,
 * });
 * export const openapi = false; // this route speaks JSON-RPC, not the REST API
 * ```
 *
 * The server is stateless and JSON-only, which the Streamable HTTP transport
 * explicitly allows: a POSTed request may be answered with `application/json`
 * instead of an SSE stream, and both session ids and the GET stream are
 * optional. Nothing here pushes messages to a client, so neither is needed,
 * the route stays a pure function of one request, and every adapter — the
 * serverless ones included — can host it.
 *
 * What you write is the part no schema can carry: each tool's name, its
 * description, and which operations exist at all. Everything else is derived —
 * `tools/list` converts the input schemas to JSON Schema through the same
 * vendor detection the OpenAPI document uses, `tools/call` validates against
 * them, and the protocol (initialize and version negotiation, the Origin
 * check, the 401 challenge that starts OAuth) is the same for every app.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { handlerDefinition, type Method } from "./endpoint.ts";
import { formatSchemaIssues, isHttpError, isRedirect } from "./errors.ts";
import type { RequestEvent, RequestHandler } from "./match.ts";
import { convertStandardSchema, type JsonSchema } from "./openapi.ts";
// type-only, so this never becomes a runtime cycle with `./server.ts`
import type { MaybePromise } from "./server.ts";

// ---------------------------------------------------------------------------
// Protocol versions
// ---------------------------------------------------------------------------

/**
 * The spec revisions this server's behavior is written against. The newest one
 * is what an `initialize` asking for something unknown is answered with —
 * claiming a revision whose requirements this file has not read would be
 * worse than offering an older one the client may still accept.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const LATEST_PROTOCOL_VERSION: string = SUPPORTED_PROTOCOL_VERSIONS[0];

/**
 * What an absent `MCP-Protocol-Version` header means. The spec says to assume
 * this revision rather than reject, so a client from before the header existed
 * still connects.
 */
export const ASSUMED_PROTOCOL_VERSION = "2025-03-26";

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

export const JSON_RPC_ERRORS = {
	parseError: -32700,
	invalidRequest: -32600,
	methodNotFound: -32601,
	invalidParams: -32602,
	internalError: -32603,
} as const;

/** A request's id. JSON-RPC also allows `null`; MCP forbids it. */
type JsonRpcId = string | number;

type JsonRpcMessage = { jsonrpc: "2.0"; id?: unknown; method?: unknown; params?: unknown };

type JsonRpcRequest = JsonRpcMessage & { id: JsonRpcId; method: string };

/** A plain object — what JSON-RPC `params`, tool arguments, and envelopes must be. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
	return isRecord(value) && value["jsonrpc"] === "2.0";
}

/**
 * A message that wants an answer. A notification has no `id`, a response no
 * `method` — and an `id` of `null`, which MCP forbids on requests, is treated
 * as neither rather than answered.
 */
function isJsonRpcRequest(message: JsonRpcMessage): message is JsonRpcRequest {
	return (
		typeof message.method === "string" &&
		(typeof message.id === "string" || typeof message.id === "number")
	);
}

function rpcResult(id: JsonRpcId, result: unknown): Record<string, unknown> {
	return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId | null, code: number, message: string): Record<string, unknown> {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * The hints a tool may carry about its behavior. All of them are advisory —
 * a client shows them to a human, it does not enforce them.
 */
export type ToolAnnotations = {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
} & Record<string, unknown>;

/** What a `tools/call` answers with: content for the model, and whether it failed. */
export type ToolResult = {
	content: { type: "text"; text: string }[];
	isError?: boolean;
};

/**
 * Marks the results this module builds, so `handle` returning one is told
 * apart from `handle` returning data that happens to have a `content` key —
 * data is always wrapped, an envelope never is.
 */
const TOOL_RESULT: unique symbol = Symbol.for("@implementjs/kit:mcp-tool-result");

function branded(result: ToolResult): ToolResult {
	Object.defineProperty(result, TOOL_RESULT, { value: true, enumerable: false });
	return result;
}

function isToolResult(value: unknown): value is ToolResult {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The brand is this module's own symbol, only ever set by branded().
	return isRecord(value) && (value as Record<symbol, unknown>)[TOOL_RESULT] === true;
}

/** A failed call: the model reads `message` and decides what to do about it. */
function failure(message: string): ToolResult {
	return branded({ content: [{ type: "text", text: message }], isError: true });
}

/**
 * A successful call. A string goes through as the text it is; anything else is
 * JSON for the model to read; `undefined` and `null` say only that it worked.
 */
function success(value: unknown): ToolResult {
	if (value === undefined || value === null) return branded({ content: [] });
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return branded({ content: [{ type: "text", text }] });
}

/** What a tool's `handle` receives: its validated input, and the request event. */
export type ToolEvent<Input> = {
	/**
	 * The call's arguments under the `input` schema's output — or `undefined`
	 * when the tool declares no schema, the same way an endpoint's undeclared
	 * body is never read.
	 */
	input: Input;
	/** The MCP route's own request event: `locals`, `cookies`, `fetch`, all of it. */
	event: RequestEvent;
};

/** One tool as `mcp()` holds it — the schema erased, the input untyped. */
export type McpTool = {
	name: string;
	title?: string;
	description: string;
	annotations?: ToolAnnotations;
	/** The input schema, validated on every call and converted for `tools/list`. */
	input?: StandardSchemaV1;
	/**
	 * Builds the `inputSchema` for `tools/list` instead of converting `input` —
	 * for a tool whose input is not one schema, like the endpoint bridge's
	 * params/query/body envelope.
	 */
	inputJsonSchema?: () => Promise<JsonSchema>;
	handle: (context: ToolEvent<unknown>) => unknown;
};

type Schema = StandardSchemaV1;

/** `input` as `handle` sees it: the schema's output, or nothing at all. */
type InputOf<IS> = IS extends Schema ? StandardSchemaV1.InferOutput<IS> : undefined;

export interface ToolBuilder {
	<IS extends Schema | undefined = undefined>(definition: {
		/** The name the model calls it by — short, verb-shaped, `snake_case` by convention. */
		name: string;
		title?: string;
		/**
		 * What the tool does and when to reach for it, written to the model.
		 * This is the part that makes a tool work — a schema says what the
		 * arguments are, only prose says why you would send them.
		 */
		description: string;
		/** Validates each call's `arguments` and becomes the tool's `inputSchema`. */
		input?: IS;
		annotations?: ToolAnnotations;
		handle: (context: ToolEvent<InputOf<IS>>) => MaybePromise<unknown>;
	}): McpTool;

	/**
	 * A failed call, for `handle` to return: `isError` is set and the model
	 * reads the message. Prefer this over throwing for the failures the tool
	 * expects — an issue that does not exist, a name already taken.
	 */
	failure(message: string): ToolResult;

	/**
	 * An existing endpoint as a tool, its own schemas becoming the input.
	 *
	 * ```ts
	 * import * as issues from "../api/issues/server.ts";
	 *
	 * const listIssues = tool.fromEndpoint(issues.GET, {
	 * 	name: "list_issues",
	 * 	description: "List issues, filterable by status.",
	 * 	path: "/api/issues",
	 * });
	 * ```
	 *
	 * The tool's input is an envelope of the parts the handler declares —
	 * `{ params?, query?, body? }` — and the call dispatches by function call,
	 * not HTTP: the handler runs with this route's own `locals` and `cookies`
	 * under a request built from the input, so its validation, permissions, and
	 * side effects happen exactly as a real request's would.
	 */
	fromEndpoint(
		endpoint: (event: RequestEvent) => MaybePromise<Response>,
		options: {
			name: string;
			title?: string;
			description: string;
			/** The route key the handler answers at — `/api/posts/[id]`. `input.params` fills the brackets. */
			path: string;
			/** @default "POST" when the handler declares a body, "GET" otherwise */
			method?: Method;
			annotations?: ToolAnnotations;
		},
	): McpTool;
}

/**
 * Declares one tool. The `input` schema is anything implementing [Standard
 * Schema](https://standardschema.dev) — the same contract `handler()` takes —
 * and a call whose arguments it rejects comes back to the model as a failed
 * result naming the issues, so it can correct them and retry.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The overload is the contract; the implementation only ever sees the erased definition.
export const tool = ((definition: McpTool) => ({ ...definition })) as ToolBuilder;

tool.failure = failure;

tool.fromEndpoint = (endpoint, options): McpTool => {
	const definition = handlerDefinition(endpoint);
	const paramNames = pathParams(options.path);
	return {
		name: options.name,
		...(options.title === undefined ? {} : { title: options.title }),
		description: options.description,
		...(options.annotations === undefined ? {} : { annotations: options.annotations }),
		inputJsonSchema: async () => {
			const properties: Record<string, unknown> = {};
			const required: string[] = [];
			if (paramNames.length > 0 || definition?.params !== undefined) {
				const declared =
					definition?.params === undefined
						? null
						: await convertStandardSchema(definition.params, "input");
				// every param the path binds, as a string, with what the handler
				// declares layered over it — the same merge the handler itself does
				const base: Record<string, unknown> = {};
				for (const name of paramNames) base[name] = { type: "string" };
				properties["params"] = {
					type: "object",
					properties: { ...base, ...propertiesOf(declared) },
					required: paramNames,
				};
				if (paramNames.length > 0) required.push("params");
			}
			if (definition?.query !== undefined) {
				properties["query"] = (await convertStandardSchema(definition.query, "input")) ?? {
					type: "object",
				};
			}
			if (definition?.body !== undefined) {
				properties["body"] = (await convertStandardSchema(definition.body, "input")) ?? {};
				required.push("body");
			}
			return { type: "object", properties, required };
		},
		handle: async ({ input, event }) => {
			const parts = partsOf(input);
			const path = fillPath(options.path, parts.params);
			if (path === null) {
				return failure(`missing path param — "${options.path}" needs every bracketed segment`);
			}
			const url = new URL(path, event.url.origin);
			appendQuery(url, parts.query);
			const method = options.method ?? (definition?.body === undefined ? "GET" : "POST");
			const carriesBody = method !== "GET" && method !== "HEAD" && parts.body !== undefined;
			const request = new Request(url, {
				method,
				...(carriesBody
					? {
							headers: { "content-type": "application/json" },
							body: JSON.stringify(parts.body),
						}
					: {}),
			});
			// the handler validates `params` against its own schema, so the input's
			// values pass through as sent rather than coerced to the strings routing
			// would have bound
			const response = await endpoint({
				...event,
				request,
				url,
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The handler's params schema is the contract; routing's strings are only one spelling of what it accepts.
				params: parts.params as Record<string, string>,
				route: { id: options.path },
			});
			return await resultFromResponse(response);
		},
	};
};

/** The input envelope's three parts, each defaulting to nothing. */
function partsOf(input: unknown): {
	params: Record<string, unknown>;
	query: Record<string, unknown>;
	body: unknown;
} {
	const record = isRecord(input) ? input : {};
	const part = (name: string): Record<string, unknown> => {
		const value = record[name];
		return isRecord(value) ? value : {};
	};
	return { params: part("params"), query: part("query"), body: record["body"] };
}

/** `[id]`, `[...slug]`, `[id=integer]` — capturing the name, dropping the matcher. */
const PARAM_SEGMENT = /\[(\.\.\.)?([^\]=]+)(?:=[^\]]+)?\]/g;

function pathParams(path: string): string[] {
	return [...path.matchAll(PARAM_SEGMENT)].map((match) => match[2]!);
}

/**
 * The route key with its params filled in, or `null` when one is missing. A
 * catch-all's value keeps its slashes — that is what a catch-all binds — while
 * a plain param is one segment and encodes as one.
 */
function fillPath(path: string, params: Record<string, unknown>): string | null {
	let missing = false;
	const filled = path.replaceAll(
		PARAM_SEGMENT,
		(_segment, catchAll: string | undefined, name: string) => {
			const value = params[name];
			if (value === undefined) {
				missing = true;
				return "";
			}
			const text = textOf(value);
			return catchAll === undefined ? encodeURIComponent(text) : text;
		},
	);
	return missing ? null : filled;
}

/** The input's `query` as search params — one entry per value, arrays repeating the key. */
function appendQuery(url: URL, query: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue;
		for (const entry of Array.isArray(value) ? value : [value]) {
			url.searchParams.append(key, textOf(entry));
		}
	}
}

/** A param value as text — an object would stringify as `[object Object]`, which no URL wants. */
function textOf(value: unknown): string {
	return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

/** What came back from the endpoint, as the tool's result. */
async function resultFromResponse(response: Response): Promise<ToolResult> {
	const text = await response.text();
	let parsed: unknown = text === "" ? null : text;
	try {
		if (text !== "") parsed = JSON.parse(text);
	} catch {
		// not JSON; the text is still worth showing the model
	}
	if (!response.ok) {
		const message =
			isRecord(parsed) && typeof parsed["message"] === "string"
				? parsed["message"]
				: `Request failed with ${response.status}`;
		return failure(`${message} (HTTP ${response.status})`);
	}
	return success(parsed);
}

function propertiesOf(schema: JsonSchema | null): Record<string, unknown> {
	const value = schema?.["properties"];
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Whatever the vendor produced under `properties` is a record of schemas or nothing.
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

export type McpServerInfo = { name: string; title?: string; version: string };

export type McpOptions = {
	serverInfo: McpServerInfo;
	/**
	 * Guidance the client hands the model on connect — what this server is and
	 * how to use it well, the way a tool's description is written to the model.
	 */
	instructions?: string;
	tools: McpTool[];
	/**
	 * Whether this request may use the server, from the event the app's own
	 * hooks populated. `false` answers `401` with the `WWW-Authenticate:
	 * Bearer resource_metadata="…"` challenge (RFC 9728) that tells an MCP
	 * client where to authenticate — without it a client has no way to find
	 * the authorization server, and simply fails instead of starting a login.
	 * It runs before the body is parsed: an unauthenticated client needs the
	 * challenge, not a parse error. Omitted, the server is open.
	 */
	authorize?: (event: RequestEvent) => MaybePromise<boolean>;
	/**
	 * The protected-resource metadata document the challenge names, resolved
	 * against the request's origin. Serving it is the app's business — kit only
	 * points the client at it.
	 * @default "/.well-known/oauth-protected-resource"
	 */
	resourceMetadata?: string;
};

/** What `mcp()` returns, for a route's `server.ts` to re-export. */
export type McpHandlers = { POST: RequestHandler; GET: RequestHandler; DELETE: RequestHandler };

/** A described tool, as `tools/list` answers it. */
type ToolDescription = {
	name: string;
	title?: string;
	description: string;
	inputSchema: JsonSchema;
	annotations?: ToolAnnotations;
};

/**
 * The MCP server over a set of tools, as the three handlers its route
 * re-exports. `POST` answers requests; `GET` and `DELETE` answer `405`,
 * which is the spec's designated way to say "no server-initiated stream, no
 * session to terminate" — clients treat it as a description of the server, not
 * a failure.
 *
 * Also export `openapi = false` from the route: this endpoint speaks JSON-RPC,
 * and a REST document has nothing true to say about it.
 */
export function mcp(options: McpOptions): McpHandlers {
	const byName = new Map<string, McpTool>();
	for (const entry of options.tools) {
		if (byName.has(entry.name)) {
			throw new Error(`mcp(): two tools named "${entry.name}" — names identify tools to the model`);
		}
		byName.set(entry.name, entry);
	}

	const metadataPath = options.resourceMetadata ?? "/.well-known/oauth-protected-resource";

	// assembled on the first `tools/list` and held: the schemas cannot change
	// under a running server, and the vendor converters import lazily
	let described: Promise<ToolDescription[]> | undefined;
	const describedTools = (): Promise<ToolDescription[]> => {
		described ??= Promise.all([...byName.values()].map(describeTool));
		return described;
	};

	const authorized = async (event: RequestEvent): Promise<Response | null> => {
		if (options.authorize === undefined) return null;
		if (await options.authorize(event)) return null;
		return unauthorized(event, metadataPath);
	};

	const POST: RequestHandler = async (event) => {
		const originError = checkOrigin(event);
		if (originError !== null) return originError;

		const versionError = checkProtocolVersion(event);
		if (versionError !== null) return versionError;

		const authError = await authorized(event);
		if (authError !== null) return authError;

		let payload: unknown;
		try {
			payload = await event.request.json();
		} catch {
			return json(rpcError(null, JSON_RPC_ERRORS.parseError, "Invalid JSON"), 400);
		}

		// Batches were removed in 2025-06-18, and a stateless server has no
		// ordering to offer the older revisions that allowed them.
		if (Array.isArray(payload)) {
			return json(
				rpcError(null, JSON_RPC_ERRORS.invalidRequest, "Batched requests are not supported"),
				400,
			);
		}

		if (!isJsonRpcMessage(payload)) {
			return json(rpcError(null, JSON_RPC_ERRORS.invalidRequest, "Not a JSON-RPC message"), 400);
		}

		// A notification or response gets no body — the spec is specific that
		// this is a bare 202 rather than an empty result.
		if (!isJsonRpcRequest(payload)) return new Response(null, { status: 202 });

		const { id, method } = payload;
		const params = isRecord(payload.params) ? payload.params : {};

		switch (method) {
			case "initialize":
				return json(rpcResult(id, initializeResult(options, params)));
			case "ping":
				return json(rpcResult(id, {}));
			case "tools/list":
				return json(rpcResult(id, { tools: await describedTools() }));
			case "tools/call":
				return json(rpcResult(id, await callTool(byName, event, params)));
			default:
				return json(rpcError(id, JSON_RPC_ERRORS.methodNotFound, `Unknown method: ${method}`));
		}
	};

	/** No server-initiated stream, so no GET stream to open. */
	const GET: RequestHandler = async (event) => {
		const originError = checkOrigin(event);
		if (originError !== null) return originError;
		const authError = await authorized(event);
		if (authError !== null) return authError;
		return new Response(null, { status: 405, headers: { allow: "POST" } });
	};

	/** Nothing to terminate: the server holds no session. */
	const DELETE: RequestHandler = (event) => {
		const originError = checkOrigin(event);
		if (originError !== null) return originError;
		return new Response(null, { status: 405, headers: { allow: "POST" } });
	};

	return { POST, GET, DELETE };
}

function initializeResult(options: McpOptions, params: Record<string, unknown>): unknown {
	// Answer in the client's version when it is one we speak, so an older
	// client is not forced to downgrade the connection itself.
	const asked = typeof params["protocolVersion"] === "string" ? params["protocolVersion"] : "";
	const agreed = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(asked)
		? asked
		: LATEST_PROTOCOL_VERSION;
	return {
		protocolVersion: agreed,
		capabilities: { tools: { listChanged: false } },
		serverInfo: options.serverInfo,
		...(options.instructions === undefined ? {} : { instructions: options.instructions }),
	};
}

async function describeTool(entry: McpTool): Promise<ToolDescription> {
	let inputSchema: JsonSchema;
	if (entry.inputJsonSchema !== undefined) {
		inputSchema = await entry.inputJsonSchema();
	} else if (entry.input !== undefined) {
		const converted = await convertStandardSchema(entry.input, "input");
		if (converted === null) {
			// the same posture as the OpenAPI document: an unconvertible schema
			// lists as unconstrained and says so, and validation still runs the
			// real schema on every call
			console.warn(
				`[implement] mcp — cannot convert tool "${entry.name}"'s input schema (vendor "${entry.input["~standard"].vendor}") to JSON Schema; listing it as unconstrained`,
			);
			inputSchema = { type: "object" };
		} else {
			inputSchema = converted;
		}
	} else {
		inputSchema = { type: "object", properties: {} };
	}
	return {
		name: entry.name,
		...(entry.title === undefined ? {} : { title: entry.title }),
		description: entry.description,
		inputSchema,
		...(entry.annotations === undefined ? {} : { annotations: entry.annotations }),
	};
}

/**
 * One `tools/call`. Failures the model can act on — an unknown tool, input the
 * schema rejects, an `error()` the handler threw — are tool results with
 * `isError`, not protocol errors: a protocol error says the conversation
 * broke, a failed result is something the model reads and retries.
 */
async function callTool(
	byName: Map<string, McpTool>,
	event: RequestEvent,
	params: Record<string, unknown>,
): Promise<ToolResult> {
	const name = typeof params["name"] === "string" ? params["name"] : "";
	const entry = byName.get(name);
	if (entry === undefined) return failure(`Unknown tool: ${name}`);

	const args = isRecord(params["arguments"]) ? params["arguments"] : {};
	let input: unknown;
	if (entry.input !== undefined) {
		const result = await entry.input["~standard"].validate(args);
		if (result.issues !== undefined) {
			return failure(`invalid input — ${formatSchemaIssues(result.issues)}`);
		}
		input = result.value;
	} else if (entry.inputJsonSchema !== undefined) {
		// a tool that describes its input without a runtime schema — the
		// endpoint bridge, whose handler validates for itself — reads the raw
		// arguments
		input = args;
	}

	try {
		const value = await entry.handle({ input, event });
		return isToolResult(value) ? value : success(value);
	} catch (thrown) {
		// an `error(404, …)` thrown inside a tool is the same expected failure
		// it is inside an endpoint, so it reads the same way
		if (isHttpError(thrown)) {
			return failure(`${thrown.body.message} (HTTP ${thrown.status})`);
		}
		if (isRedirect(thrown)) {
			return failure(`the tool redirected to ${thrown.location} — nothing follows redirects here`);
		}
		// the message is the app's own tool code talking, and it is what lets
		// the model adapt instead of retrying the same call
		return failure(thrown instanceof Error ? thrown.message : String(thrown));
	}
}

// ---------------------------------------------------------------------------
// Transport checks
// ---------------------------------------------------------------------------

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/**
 * The 401 an MCP client needs in order to discover where to authenticate.
 *
 * `WWW-Authenticate` with `resource_metadata` is what RFC 9728 defines and
 * what the MCP spec requires — without it a client has no way to find the
 * authorization server, and simply fails instead of starting a login.
 */
function unauthorized(event: RequestEvent, metadataPath: string): Response {
	const metadata = new URL(metadataPath, event.url.origin);
	return new Response(
		JSON.stringify({ error: "invalid_token", error_description: "Authentication required" }),
		{
			status: 401,
			headers: {
				"content-type": "application/json",
				"www-authenticate": `Bearer resource_metadata="${metadata.href}"`,
			},
		},
	);
}

/**
 * DNS-rebinding protection, which the transport spec requires.
 *
 * A web page cannot forge `Origin`, so an `http(s)` origin that is not this
 * app is a site acting on its own behalf and is rejected. Native MCP clients
 * are not websites: they send things like `vscode-file://vscode-app`, the
 * literal `"null"`, or no header at all. Treating those like a DNS-rebinding
 * attack answers `403` instead of the `401` + `WWW-Authenticate` that starts
 * OAuth — the client then shows a connected server with zero tools and no way
 * to log in.
 */
function checkOrigin(event: RequestEvent): Response | null {
	const origin = event.request.headers.get("origin");
	if (originAllowed(origin, event.url.origin)) return null;
	return json(rpcError(null, JSON_RPC_ERRORS.invalidRequest, `Origin not allowed: ${origin}`), 403);
}

function originAllowed(origin: string | null, serverOrigin: string): boolean {
	if (origin === null || origin === "null" || origin === serverOrigin) return true;
	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch {
		return false;
	}
	return parsed.protocol !== "http:" && parsed.protocol !== "https:";
}

function checkProtocolVersion(event: RequestEvent): Response | null {
	const header = event.request.headers.get("mcp-protocol-version");
	// absent means an older client; the spec says assume 2025-03-26 rather
	// than reject, so a 2024-era client still connects
	const version = header ?? ASSUMED_PROTOCOL_VERSION;
	if ((SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)) return null;
	return json(
		rpcError(
			null,
			JSON_RPC_ERRORS.invalidRequest,
			`Unsupported MCP-Protocol-Version: ${version}. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
		),
		400,
	);
}
