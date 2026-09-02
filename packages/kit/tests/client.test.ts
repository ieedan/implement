/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back stubbed responses requires intentional narrowing. */
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	ApiError,
	buildUrl,
	createClient,
	type MethodClient,
	type Operations,
	type NestedClient,
	type SocketOf,
	type ThrowWrapper,
	type TypedClient,
} from "../src/client.ts";
import {
	createClient as createResultClient,
	type ResultClient,
	type ResultNestedClient,
} from "../src/client-neverthrow.ts";
import { handler } from "../src/endpoint.ts";
import { socket } from "../src/socket.ts";

const Post = v.object({ id: v.number(), title: v.string() });

/** A stand-in `server.ts` module, so the table is built exactly the way generation builds it. */
const posts = {
	GET: handler({
		query: v.object({
			draft: v.optional(
				v.pipe(
					v.string(),
					v.transform((value) => value === "true"),
				),
				"false",
			),
		}),
		handle: ({ params }) => ({ id: params["id"] ?? "", title: "hello" }),
	}),
	PATCH: handler({
		body: v.pick(Post, ["title"]),
		response: Post,
		handle: ({ body }) => ({ id: 1, title: body.title }),
	}),
};

declare const plain: (event: never) => Promise<Response>;

type Api = {
	"/api/posts/[id]": { params: { id: string }; operations: Operations<typeof posts> };
	"/docs/[...slug].md": { params: { slug: string }; operations: Operations<{ GET: typeof plain }> };
};

/** A `server.ts` at `src/routes/server.ts` — the route the nested tree keeps at its own root. */
type RootOperations = Operations<{ GET: typeof plain }>;

// The nested tree offers exactly what the table has, which `tsc` is the only
// one who can check — every one of these is an error, and `@ts-expect-error`
// fails the type check if it stops being one.
type Nested = NestedClient<Api>;
// @ts-expect-error nothing continues `/api/posts` with a `comments` segment
export type _NoSuchSegment = Nested["api"]["posts"]["comments"];
// @ts-expect-error `/api` is a prefix of a route, not a route of its own
export type _NoSuchRoute = Nested["api"]["GET"];
// @ts-expect-error the route serves `GET` and `PATCH`, and nothing else
export type _NoSuchMethod = Nested["api"]["posts"]["[id]"]["DELETE"];

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

describe('the "nested" style', () => {
	it("calls through the route's segments", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createClient<NestedClient<Api>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "nested",
		});
		const { data } = await api.api.posts["[id]"].GET({ params: { id: "7" } });
		expect(data).toEqual({ id: "7", title: "hello" });
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/api/posts/7`);
	});

	it("keeps a leaf's extension and its own body and query", async () => {
		const stubbed = stub(() => Response.json({ id: 1, title: "renamed" }));
		const api = createClient<NestedClient<Api>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "nested",
		});
		await api.docs["[...slug].md"].GET({ params: { slug: "guide/install" } });
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/docs/guide/install.md`);

		const { data } = await api.api.posts["[id]"].PATCH({
			params: { id: "7" },
			body: { title: "renamed" },
		});
		expect(data).toEqual({ id: 1, title: "renamed" });
		expect(stubbed.seen[1]!.method).toBe("PATCH");
	});

	it('serves a route at the root of the tree, which is keyed "/"', async () => {
		const stubbed = stub(() => Response.json({ ok: true }));
		const api = createClient<NestedClient<{ "/": { params: {}; operations: RootOperations } }>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "nested",
		});
		await api.GET();
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/`);
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

	it("wraps a nested client's calls too", async () => {
		const stubbed = stub(() => Response.json({ id: "7", title: "hello" }));
		const api = createResultClient<ResultNestedClient<Api>>({
			baseUrl: ORIGIN,
			fetch: stubbed.fetch,
			style: "nested",
		});
		const post = await api.api.posts["[id]"].GET({ params: { id: "7" } }).unwrapOr(null);
		expect(post).toEqual({ id: "7", title: "hello" });
		expect(stubbed.seen[0]!.url).toBe(`${ORIGIN}/api/posts/7`);
	});
});

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------

const ClientMessage = v.variant("type", [
	v.object({ type: v.literal("join"), user: v.string() }),
	v.object({ type: v.literal("chat"), text: v.string() }),
]);
const ServerMessage = v.object({ type: v.literal("chat"), from: v.string(), text: v.string() });

/** A stand-in socket route, built the way a `server.ts` builds one. */
const room = {
	SOCKET: socket({
		incoming: ClientMessage,
		outgoing: ServerMessage,
		on: { join: () => undefined, chat: () => undefined },
	}),
	// a directory serves a socket *and* its methods, and the client offers both
	GET: posts.GET,
};

type SocketApi = {
	"/api/room/[id]": {
		params: { id: string };
		operations: Operations<typeof room>;
		socket: SocketOf<typeof room>;
	};
	"/api/posts/[id]": {
		params: { id: string };
		operations: Operations<typeof posts>;
		socket: SocketOf<typeof posts>;
	};
};

declare const socketApi: TypedClient<SocketApi>;

// only the routes that declare one are reachable, which is the same guarantee
// `KeyFor` gives the seven methods
// @ts-expect-error `/api/posts/[id]` exports no SOCKET
export type _NotASocketRoute = ReturnType<typeof socketApi.SOCKET<"/api/posts/[id]">>;

declare const roomSocket: ReturnType<typeof socketApi.SOCKET<"/api/room/[id]">>;

/** What the two ends may send is what the route's schemas said. */
export function socketTypes(): void {
	roomSocket.send({ type: "chat", text: "hi" });
	roomSocket.send({ type: "join", user: "ada" });
	// @ts-expect-error `text` belongs to the chat member, not the join one
	roomSocket.send({ type: "join", text: "hi" });
	// @ts-expect-error the route never accepts a bare string
	roomSocket.send("hi");

	const status: "connecting" | "open" | "closed" = roomSocket.status.get();
	void status;

	roomSocket.onMessage((message) => {
		const from: string = message.from;
		void from;
		// @ts-expect-error the outgoing schema says nothing about `user`
		void message.user;
	});
}

/** A socket the tests drive by hand, standing in for the browser's. */
class FakeSocket extends EventTarget {
	static instances: FakeSocket[] = [];
	readyState = 0;
	bufferedAmount = 0;
	binaryType = "blob";
	readonly sent: unknown[] = [];

	constructor(
		readonly url: string,
		readonly protocols: string | string[],
	) {
		super();
		FakeSocket.instances.push(this);
	}

	send(data: unknown): void {
		this.sent.push(data);
	}

	close(code?: number, reason?: string): void {
		this.drop(code ?? 1000, reason ?? "", true);
	}

	/** What the server end would do: accept the connection. */
	accept(): void {
		this.readyState = 1;
		this.dispatchEvent(new Event("open"));
	}

	/** A message arriving from the server. */
	deliver(data: unknown): void {
		this.dispatchEvent(Object.assign(new Event("message"), { data }));
	}

	drop(code: number, reason = "", wasClean = false): void {
		this.readyState = 3;
		this.dispatchEvent(Object.assign(new Event("close"), { code, reason, wasClean }));
	}
}

const fakeSockets = () => {
	FakeSocket.instances = [];
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A stand-in for the browser's constructor; only what the client touches is implemented.
	return FakeSocket as unknown as typeof globalThis.WebSocket;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("api.SOCKET", () => {
	it("builds the URL from the route's params and switches the scheme", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "https://example.com",
			socket: { WebSocket, reconnect: false },
		});
		api.SOCKET("/api/room/[id]", { params: { id: "42" }, query: { token: "abc" } });
		expect(FakeSocket.instances[0]?.url).toBe("wss://example.com/api/room/42?token=abc");
	});

	it("sends what the route declared, as JSON", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: false },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		const wire = FakeSocket.instances[0]!;

		// nothing goes out before the socket is open, and nothing is queued
		room.send({ type: "chat", text: "early" });
		expect(wire.sent).toEqual([]);

		wire.accept();
		await room.opened;
		room.send({ type: "chat", text: "hi" });
		expect(wire.sent).toEqual(['{"type":"chat","text":"hi"}']);
	});

	it("reads messages back as the outgoing schema describes them", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: false },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		const wire = FakeSocket.instances[0]!;
		wire.accept();

		const seen: unknown[] = [];
		const read = (async () => {
			for await (const message of room) {
				seen.push(message);
				if (seen.length === 2) break;
			}
		})();
		wire.deliver('{"type":"chat","from":"ada","text":"one"}');
		wire.deliver('{"type":"chat","from":"ada","text":"two"}');
		await read;
		expect(seen).toEqual([
			{ type: "chat", from: "ada", text: "one" },
			{ type: "chat", from: "ada", text: "two" },
		]);
		// breaking out of the loop closes the connection, as it does for `sse`
		expect(room.status.get()).toBe("closed");
	});

	it("tracks the connection as a readable", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: false },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		expect(room.status.get()).toBe("connecting");

		const seen: string[] = [];
		room.status.subscribe((status) => seen.push(status));
		const wire = FakeSocket.instances[0]!;

		wire.accept();
		await settle();
		expect(room.status.get()).toBe("open");

		wire.drop(1006);
		await settle();
		expect(room.status.get()).toBe("closed");
		// the readable is what a connection indicator binds to, so every state it
		// passed through has to reach a subscriber
		expect(seen).toContain("open");
		expect(seen.at(-1)).toBe("closed");
	});

	it("reconnects with a growing backoff, and says so on the way", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: { retries: 2, delay: 1, maxDelay: 1 } },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		FakeSocket.instances[0]!.accept();
		await room.opened;

		const closes: number[] = [];
		room.onClose((details) => closes.push(details.code));

		FakeSocket.instances[0]!.drop(1006);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(FakeSocket.instances).toHaveLength(2);
		expect(room.status.get()).toBe("connecting");

		FakeSocket.instances[1]!.accept();
		await settle();
		expect(room.status.get()).toBe("open");
		expect(closes).toEqual([1006]);
	});

	it("runs onReconnect on every connection after the first", async () => {
		const WebSocket = fakeSockets();
		const opened: number[] = [];
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: {
				WebSocket,
				reconnect: { retries: 2, delay: 1, maxDelay: 1 },
				onReconnect: () => opened.push(1),
			},
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		FakeSocket.instances[0]!.accept();
		await room.opened;
		// the first connection is not a reconnection
		expect(opened).toEqual([]);

		FakeSocket.instances[0]!.drop(1006);
		await new Promise((resolve) => setTimeout(resolve, 20));
		FakeSocket.instances[1]!.accept();
		await settle();
		expect(opened).toEqual([1]);
	});

	it("gives up once the retries run out, and rejects `opened` when none connected", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: { retries: 1, delay: 1, maxDelay: 1 } },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		FakeSocket.instances[0]!.drop(1006);
		await new Promise((resolve) => setTimeout(resolve, 20));
		FakeSocket.instances[1]!.drop(1006);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(room.status.get()).toBe("closed");
		await expect(room.opened).rejects.toThrow(/could not open a socket/);
	});

	it("rejects `opened` on a refused handshake when reconnecting is off", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<TypedClient<SocketApi>>({
			baseUrl: "http://localhost",
			socket: { WebSocket, reconnect: false },
		});
		const room = api.SOCKET("/api/room/[id]", { params: { id: "1" } });
		FakeSocket.instances[0]!.drop(1006);
		await expect(room.opened).rejects.toThrow(/could not open a socket/);
		expect(room.status.get()).toBe("closed");
	});

	it("is reachable through the nested style too", async () => {
		const WebSocket = fakeSockets();
		const api = createClient<NestedClient<SocketApi>>({
			baseUrl: "http://localhost",
			style: "nested",
			socket: { WebSocket, reconnect: false },
		});
		api.api.room["[id]"].SOCKET({ params: { id: "7" } });
		expect(FakeSocket.instances[0]?.url).toBe("ws://localhost/api/room/7");
	});
});
