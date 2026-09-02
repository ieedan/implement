/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading locals and peer params back requires intentional narrowing. */
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it, vi } from "vitest";
import type { EndpointRoute, RequestEvent } from "../src/match.ts";
import {
	createKitServer,
	error,
	type Handle,
	type KitServerOptions,
	type ServerErrorReport,
} from "../src/server.ts";
import {
	createSocketSession,
	isUpgradeRequest,
	matchSocket,
	socket,
	socketMessage,
	SocketReadyState,
	type SocketConnection,
	type SocketDefinition,
	type SocketPeer,
} from "../src/socket.ts";

type Locals = { user?: string };

const endpoint = (pattern: string, module: Record<string, unknown>): EndpointRoute => ({
	pattern,
	id: pattern,
	extension: null,
	file: `${pattern.slice(1) || "root"}/server.ts`,
	module,
});

/** A transport a test drives by hand: what was sent, what was closed, how full it is. */
function transport() {
	const sent: (string | Uint8Array)[] = [];
	const closed: { code?: number; reason?: string }[] = [];
	let readyState: number = SocketReadyState.OPEN;
	let bufferedAmount = 0;
	const connection: SocketConnection = {
		send: (data) => {
			sent.push(data);
		},
		close: (code, reason) => {
			closed.push({ code, reason });
			readyState = SocketReadyState.CLOSED;
		},
		get bufferedAmount() {
			return bufferedAmount;
		},
		get readyState() {
			return readyState;
		},
	};
	return {
		connection,
		sent,
		closed,
		fill: (bytes: number) => {
			bufferedAmount = bytes;
		},
		drop: () => {
			readyState = SocketReadyState.CLOSED;
		},
	};
}

const event = (url = "http://localhost/ws", locals: Locals = {}): RequestEvent =>
	({
		request: new Request(url),
		url: new URL(url),
		locals,
	}) as unknown as RequestEvent;

function session(
	definition: SocketDefinition,
	options: { onError?: (error: unknown) => void } = {},
) {
	const wire = transport();
	const driver = createSocketSession({
		definition,
		connection: wire.connection,
		event: event(),
		params: {},
		onError: options.onError,
	});
	return { ...wire, driver, peer: driver.peer as unknown as SocketPeer };
}

/** Lets the session's callback chain settle — every callback is queued on a promise. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("socket()", () => {
	it("keeps the callbacks it was given", async () => {
		const open = vi.fn();
		const handler = socket({ open });
		const definition = matchSocket([endpoint("/ws", { SOCKET: handler })], "/ws", "structure");
		expect(definition?.definition.open).toBe(open);
	});

	it("takes a bare function as the open callback, handed the peer's teardown signal", async () => {
		let aborted = false;
		const handler = socket((peer, signal) => {
			expect(signal).toBe(peer.signal);
			signal.addEventListener("abort", () => {
				aborted = true;
			});
		});
		const match = matchSocket([endpoint("/ws", { SOCKET: handler })], "/ws", "structure")!;
		const run = session(match.definition);
		run.driver.open();
		await settle();
		run.driver.closed({ code: 1000, clean: true });
		await settle();
		expect(aborted).toBe(true);
	});

	it("refuses a SOCKET export that is not one, naming the file", () => {
		expect(() =>
			matchSocket([endpoint("/ws", { SOCKET: { open: () => undefined } })], "/ws", "structure"),
		).toThrow(/not a socket\(\) handler/);
	});

	it("does not fall through to a broader route that has one", () => {
		const routes = [
			endpoint("/", { SOCKET: socket({}) }),
			endpoint("/ws", { GET: () => new Response(null) }),
		];
		expect(matchSocket(routes, "/ws", "structure")).toBeNull();
	});
});

/** A request to `/ws` with whatever headers a case wants on it. */
const request = (headers: Record<string, string>, method = "GET") =>
	new Request("http://localhost/ws", { method, headers });

describe("isUpgradeRequest", () => {
	it("accepts the handshake a browser sends", () => {
		expect(isUpgradeRequest(request({ connection: "Upgrade", upgrade: "websocket" }))).toBe(true);
	});

	it("accepts a Connection list a proxy added to", () => {
		expect(
			isUpgradeRequest(request({ connection: "keep-alive, Upgrade", upgrade: "WebSocket" })),
		).toBe(true);
	});

	it("rejects an ordinary request, and an upgrade that is not a GET", () => {
		expect(isUpgradeRequest(request({}))).toBe(false);
		expect(isUpgradeRequest(request({ connection: "Upgrade", upgrade: "websocket" }, "POST"))).toBe(
			false,
		);
	});
});

describe("socketMessage", () => {
	it("keeps a text frame a string and a binary frame bytes", () => {
		expect(socketMessage("hi").binary).toBe(false);
		expect(socketMessage(new Uint8Array([1, 2])).binary).toBe(true);
	});

	it("converts on demand, both ways", () => {
		const text = socketMessage('{"a":1}');
		expect(text.json()).toEqual({ a: 1 });
		expect([...text.uint8Array()]).toEqual([...new TextEncoder().encode('{"a":1}')]);

		const bytes = socketMessage(new TextEncoder().encode("hello"));
		expect(bytes.text()).toBe("hello");
		expect(new Uint8Array(bytes.arrayBuffer())).toEqual(new TextEncoder().encode("hello"));
	});
});

describe("a session", () => {
	it("runs the callbacks in order, holding the next message for a slow one", async () => {
		const seen: string[] = [];
		const run = session({
			open: () => {
				seen.push("open");
			},
			message: async (_peer, message) => {
				await new Promise((resolve) => setTimeout(resolve, message.text() === "slow" ? 10 : 0));
				seen.push(message.text());
			},
			close: () => {
				seen.push("close");
			},
		});
		run.driver.open();
		run.driver.message("slow");
		run.driver.message("fast");
		run.driver.closed({ code: 1000, clean: true });
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(seen).toEqual(["open", "slow", "fast", "close"]);
	});

	it("sends through the transport and stops once the peer is gone", async () => {
		const run = session({});
		run.peer.send("one");
		run.driver.closed({ code: 1000, clean: true });
		await settle();
		run.peer.send("two");
		expect(run.sent).toEqual(["one"]);
	});

	it("normalizes what send takes to what the transport writes", () => {
		const run = session({});
		run.peer.send(new Uint8Array([1, 2, 3]).buffer);
		run.peer.send(new Uint8Array([4]));
		expect(run.sent.map((data) => [...(data as Uint8Array)])).toEqual([[1, 2, 3], [4]]);
	});

	it("reports the close code and reason, then aborts the peer's signal", async () => {
		const close = vi.fn();
		const run = session({ close });
		run.driver.closed({ code: 1001, reason: "going away", clean: true });
		await settle();
		expect(close).toHaveBeenCalledWith(expect.anything(), {
			code: 1001,
			reason: "going away",
			clean: true,
		});
		expect(run.peer.signal.aborted).toBe(true);
	});

	it("calls a socket that died without a close frame abnormal", async () => {
		const close = vi.fn();
		const run = session({ close });
		run.driver.closed();
		await settle();
		expect(close.mock.calls[0]?.[1]).toEqual({ code: 1006, reason: "", clean: false });
	});

	it("reports it once, however many times the transport says so", async () => {
		const close = vi.fn();
		const run = session({ close });
		run.driver.closed({ code: 1000, clean: true });
		run.driver.closed({ code: 1006 });
		await settle();
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("hands what a callback threw to the route's error handler", async () => {
		const onError = vi.fn();
		const failures: unknown[] = [];
		const run = session(
			{
				message: () => {
					throw new Error("boom");
				},
				error: (_peer, thrown) => {
					failures.push(thrown);
				},
			},
			{ onError },
		);
		run.driver.message("x");
		await settle();
		expect((failures[0] as Error).message).toBe("boom");
		expect(onError).not.toHaveBeenCalled();
	});

	it("falls back to the reporter when the route declares no error handler", async () => {
		const onError = vi.fn();
		const run = session(
			{
				message: () => {
					throw new Error("boom");
				},
			},
			{ onError },
		);
		run.driver.message("x");
		await settle();
		expect((onError.mock.calls[0]![0] as Error).message).toBe("boom");
	});
});

describe("backpressure", () => {
	it("waits for the buffer to drain, and reports what is queued", async () => {
		const run = session({});
		run.fill(5_000);
		let resolved = false;
		const waiting = run.peer.drained(1_000).then(() => {
			resolved = true;
		});
		await settle();
		expect(resolved).toBe(false);
		expect(run.peer.bufferedAmount).toBe(5_000);

		// still over the limit: waking is not the same as draining
		run.fill(2_000);
		run.driver.drained();
		await settle();
		expect(resolved).toBe(false);

		run.fill(500);
		run.driver.drained();
		await waiting;
		expect(resolved).toBe(true);
	});

	it("stops waiting when the peer closes, rather than stranding the producer", async () => {
		const run = session({});
		run.fill(5_000);
		const waiting = run.peer.drained();
		run.driver.closed({ code: 1006 });
		await expect(waiting).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

const UPGRADE_HEADERS = { connection: "Upgrade", upgrade: "websocket" };

function server(
	module: Record<string, unknown>,
	hooks: KitServerOptions["hooks"] = {},
	overrides: Partial<KitServerOptions> = {},
) {
	return createKitServer({
		hooks,
		pages: [],
		endpoints: [endpoint("/ws", module), endpoint("/plain", { GET: () => new Response("ok") })],
		renderPage: () => null,
		...overrides,
	});
}

const upgradeRequest = (path = "/ws") =>
	new Request(`http://localhost${path}`, { headers: UPGRADE_HEADERS });

/** Puts a user on `event.locals`, the way an auth hook would. */
const signIn: Handle = ({ event: current, resolve }) => {
	(current.locals as Locals).user = "ada";
	return resolve(current);
};

/** Issues a cookie and picks a subprotocol on the way through. */
const issueSession: Handle = ({ event: current, resolve }) => {
	current.cookies.set("session", "abc", { path: "/" });
	current.setHeaders({ "sec-websocket-protocol": "relay" });
	return resolve(current);
};

/** Resolves, then answers with something else — a redirect, say. */
const resolveThenRedirect: Handle = async ({ event: current, resolve }) => {
	await resolve(current);
	return new Response(null, { status: 302, headers: { location: "/login" } });
};

/** Never resolves at all: the hook itself is the answer. */
const refuse: Handle = () => new Response("no", { status: 401 });

describe("createKitServer().upgrade", () => {
	it("says whether the app declares any socket route at all", () => {
		expect(server({ SOCKET: socket({}) }).hasSockets).toBe(true);
		expect(server({ GET: () => new Response(null) }).hasSockets).toBe(false);
	});

	it("answers null for a path no socket route claims, so the host can keep looking", async () => {
		const kit = server({ GET: () => new Response(null) });
		expect(await kit.upgrade(upgradeRequest())).toBeNull();
		expect(await kit.upgrade(upgradeRequest("/plain"))).toBeNull();
		expect(await kit.upgrade(upgradeRequest("/nowhere"))).toBeNull();
	});

	it("accepts, and hands the peer what the hooks put on the event", async () => {
		const kit = server({ SOCKET: socket({}) }, { handle: signIn });
		const result = await kit.upgrade(upgradeRequest());
		expect(result?.accepted).toBe(true);
		if (result?.accepted !== true) return;
		const wire = transport();
		const peer = result.accept(wire.connection).peer as unknown as SocketPeer;
		expect((peer.locals as Locals).user).toBe("ada");
		expect(peer.url.pathname).toBe("/ws");
	});

	it("carries the cookies a hook issued onto the handshake", async () => {
		const result = await server({ SOCKET: socket({}) }, { handle: issueSession }).upgrade(
			upgradeRequest(),
		);
		expect(result?.accepted).toBe(true);
		if (result?.accepted !== true) return;
		expect(result.headers.get("set-cookie")).toContain("session=abc");
		expect(result.headers.get("sec-websocket-protocol")).toBe("relay");
		// the marker the pipeline uses to tell an accept from a hook's own response
		expect(result.headers.get("x-implement-upgrade")).toBeNull();
	});

	it("refuses when the route's upgrade hook throws, with the status it threw", async () => {
		const kit = server({
			SOCKET: socket({
				upgrade: ({ locals }) => {
					if ((locals as Locals).user === undefined) error(401, "sign in first");
				},
			}),
		});
		const result = await kit.upgrade(upgradeRequest());
		expect(result?.accepted).toBe(false);
		if (result?.accepted !== false) return;
		expect(result.response.status).toBe(401);
		expect(await result.response.json()).toEqual({ message: "sign in first" });
	});

	it("refuses when the route's upgrade hook answers with a response of its own", async () => {
		const kit = server({
			SOCKET: socket({ upgrade: () => new Response("nope", { status: 403 }) }),
		});
		const result = await kit.upgrade(upgradeRequest());
		expect(result?.accepted).toBe(false);
		if (result?.accepted !== false) return;
		expect(result.response.status).toBe(403);
	});

	it("refuses when handle resolves and then answers with something else", async () => {
		const result = await server({ SOCKET: socket({}) }, { handle: resolveThenRedirect }).upgrade(
			upgradeRequest(),
		);
		expect(result?.accepted).toBe(false);
		if (result?.accepted !== false) return;
		expect(result.response.status).toBe(302);
	});

	it("refuses when handle never resolves at all", async () => {
		const result = await server({ SOCKET: socket({}) }, { handle: refuse }).upgrade(
			upgradeRequest(),
		);
		expect(result?.accepted).toBe(false);
		if (result?.accepted !== false) return;
		expect(result.response.status).toBe(401);
	});

	it("reports what the upgrade hook threw against the route's own file", async () => {
		const reports: ServerErrorReport[] = [];
		const kit = server({
			SOCKET: socket({
				upgrade: () => {
					throw new Error("boom");
				},
			}),
		});
		const result = await kit.upgrade(upgradeRequest(), {
			onError: (report) => reports.push(report),
		});
		expect(result?.accepted).toBe(false);
		expect(reports[0]?.source).toEqual({ kind: "socket", file: "ws/server.ts" });
	});

	it("runs the params schema, and answers a rejection with a 400", async () => {
		const schema = {
			"~standard": {
				version: 1 as const,
				vendor: "test",
				validate: (value: unknown) => {
					const id = (value as { id?: string }).id ?? "";
					return /^\d+$/.test(id)
						? { value: { id: Number(id) } }
						: { issues: [{ message: "expected a number" }] };
				},
			},
		};
		const routes = [
			{
				...endpoint("/room/:id", { SOCKET: socket({ params: schema, open: () => undefined }) }),
				file: "room/[id]/server.ts",
			},
		];
		const kit = createKitServer({
			hooks: {},
			pages: [],
			endpoints: routes,
			renderPage: () => null,
		});

		const good = await kit.upgrade(
			new Request("http://localhost/room/7", { headers: UPGRADE_HEADERS }),
		);
		expect(good?.accepted).toBe(true);
		if (good?.accepted !== true) return;
		const peer = good.accept(transport().connection).peer as unknown as SocketPeer<{ id: number }>;
		expect(peer.params).toEqual({ id: 7 });

		const bad = await kit.upgrade(
			new Request("http://localhost/room/abc", { headers: UPGRADE_HEADERS }),
		);
		expect(bad?.accepted).toBe(false);
		if (bad?.accepted !== false) return;
		expect(bad.response.status).toBe(400);
	});

	it("reports what a message handler throws through the pipeline's reporter", async () => {
		const reports: ServerErrorReport[] = [];
		const kit = server({
			SOCKET: socket({
				message: () => {
					throw new Error("relay failed");
				},
			}),
		});
		const result = await kit.upgrade(upgradeRequest(), {
			onError: (report) => reports.push(report),
		});
		if (result?.accepted !== true) throw new Error("expected an accepted upgrade");
		const driver = result.accept(transport().connection);
		driver.message("x");
		await settle();
		expect(reports[0]?.source).toEqual({ kind: "socket", file: "ws/server.ts" });
		expect((reports[0]!.error as Error).message).toBe("relay failed");
	});
});

// ---------------------------------------------------------------------------
// Typed messages
// ---------------------------------------------------------------------------

/** A tiny Standard Schema, so these tests carry no schema-library dependency. */
function schema<T>(check: (value: unknown) => T | string): StandardSchemaV1<T, T> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			validate: (value) => {
				const result = check(value);
				return typeof result === "string" ? { issues: [{ message: result }] } : { value: result };
			},
		},
	};
}

type Chat = { type: "chat"; text: string };
type Join = { type: "join"; user: string };

const ClientMessage = schema<Chat | Join>((value) => {
	if (typeof value !== "object" || value === null) return "expected an object";
	const message = value as Record<string, unknown>;
	if (message.type === "chat" && typeof message.text === "string") {
		return { type: "chat", text: message.text };
	}
	if (message.type === "join" && typeof message.user === "string") {
		return { type: "join", user: message.user };
	}
	return "unknown message";
});

describe("an incoming schema", () => {
	it("parses the frame and hands the route the value, keeping the frame beside it", async () => {
		const seen: unknown[] = [];
		const run = session({
			incoming: ClientMessage,
			message: (_peer, message) => {
				seen.push(message.data);
				seen.push(message.raw);
			},
		});
		run.driver.message('{"type":"chat","text":"hi"}');
		await settle();
		expect(seen).toEqual([{ type: "chat", text: "hi" }, '{"type":"chat","text":"hi"}']);
	});

	it("closes with 1008 on a message it rejects, after the route hears about it", async () => {
		const failures: unknown[] = [];
		const run = session({
			incoming: ClientMessage,
			message: () => failures.push("should not run"),
			error: (_peer, thrown) => failures.push(thrown),
		});
		run.driver.message('{"type":"shout"}');
		await settle();
		expect((failures[0] as Error).message).toContain("unknown message");
		// the peer is talking a protocol this route does not speak
		expect(run.closed).toEqual([{ code: 1008, reason: expect.any(String) }]);
		expect(failures).toHaveLength(1);
	});

	it("treats a frame that is not JSON at all the same way", async () => {
		const failures: unknown[] = [];
		const run = session({
			incoming: ClientMessage,
			error: (_peer, thrown) => failures.push(thrown),
			message: () => undefined,
		});
		run.driver.message("not json");
		await settle();
		expect((failures[0] as Error).message).toContain("not valid JSON");
		expect(run.closed[0]?.code).toBe(1008);
	});

	it("leaves a route with no schema reading the raw frame", async () => {
		const seen: unknown[] = [];
		const run = session({ message: (_peer, message) => seen.push(message.data) });
		run.driver.message("plain text");
		await settle();
		expect(seen).toEqual(["plain text"]);
	});
});

describe("an outgoing schema", () => {
	it("serializes what send is given as JSON", () => {
		const run = session({ outgoing: ClientMessage, open: () => undefined });
		run.peer.send({ type: "chat", text: "hi" } as never);
		expect(run.sent).toEqual(['{"type":"chat","text":"hi"}']);
	});

	it("leaves sendRaw alone, for the binary half of a typed protocol", () => {
		const run = session({ outgoing: ClientMessage, open: () => undefined });
		run.peer.sendRaw(new Uint8Array([1, 2]));
		expect(run.sent.map((data) => [...(data as Uint8Array)])).toEqual([[1, 2]]);
	});

	it("sends a string as it is when the route declares no schema", () => {
		const run = session({});
		run.peer.send("already a frame");
		expect(run.sent).toEqual(["already a frame"]);
	});
});

describe("dispatching a tagged union", () => {
	const handlers = (seen: string[]): SocketDefinition => ({
		incoming: ClientMessage,
		message: (_peer, message) => seen.push(`every:${(message.data as Chat | Join).type}`),
		on: {
			chat: (_peer, data) => seen.push(`chat:${(data as unknown as Chat).text}`),
			join: (_peer, data) => seen.push(`join:${(data as unknown as Join).user}`),
		},
	});

	it("routes each member to its own handler", async () => {
		const seen: string[] = [];
		const run = session(handlers(seen));
		run.driver.message('{"type":"chat","text":"hi"}');
		run.driver.message('{"type":"join","user":"ada"}');
		await settle();
		// `message` sees everything, and `on` dispatches after it
		expect(seen).toEqual(["every:chat", "chat:hi", "every:join", "join:ada"]);
	});

	it("takes a discriminant of the route's choosing", async () => {
		const seen: string[] = [];
		const run = session({
			incoming: schema<{ kind: "ping" }>(() => ({ kind: "ping" })),
			discriminant: "kind",
			on: { ping: () => seen.push("pinged") },
		});
		run.driver.message("{}");
		await settle();
		expect(seen).toEqual(["pinged"]);
	});
});
