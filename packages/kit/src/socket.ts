/**
 * WebSockets: the `socket()` handler a `server.ts` exports as `SOCKET`, the
 * {@link SocketPeer} a handler talks to a client through, and the session
 * driver an adapter feeds transport events into.
 *
 * ```ts
 * // src/routes/api/relay/server.ts
 * import { socket } from "./$types";
 *
 * export const SOCKET = socket({
 * 	open: (peer) => peer.send(JSON.stringify({ hello: peer.id })),
 * 	message: (peer, message) => peer.send(message.text()),
 * 	close: (peer) => release(peer.id),
 * });
 * ```
 *
 * An upgrade goes through the same pipeline a request does — `hooks.server.ts`
 * runs, `event.locals` is filled in, cookies are read and written — and only
 * then is the connection accepted. Refusing one is `error(401, …)` from the
 * route's `upgrade` hook or from `handle`, which the client sees as the HTTP
 * status of a handshake that never completed.
 *
 * Dependency-free and web-standard throughout, like `./sse.ts` and
 * `./endpoint.ts`: nothing here may import `@implementjs/core` or `node:*`,
 * since the same module runs inside a Cloudflare worker. The wire protocol
 * lives beside its transport — `./websocket.ts` for a Node socket, and the
 * host's own implementation everywhere else.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { error, formatSchemaIssues } from "./errors.ts";
import type { EndpointRoute, MatcherMode, RequestEvent } from "./match.ts";
import { matchEndpoint, normalizeRoutePath } from "./match.ts";
// type-only, so this never becomes a runtime cycle with `./server.ts`
import type { MaybePromise } from "./server.ts";

/** The name a `server.ts` exports its socket handler under. */
export const SOCKET_EXPORT = "SOCKET";

/**
 * A peer's connection state, with the numbers `WebSocket` itself uses so a
 * `readyState` read here and one read in the browser mean the same thing.
 */
export const SocketReadyState = {
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3,
} as const;

export type SocketReadyState = (typeof SocketReadyState)[keyof typeof SocketReadyState];

/** What a peer may be sent: text, or bytes. */
export type SocketData = string | ArrayBuffer | ArrayBufferView;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * One message, as it arrived.
 *
 * {@link SocketMessage.data} is the payload the route works with: the
 * `incoming` schema's output where the route declares one, and the raw frame
 * where it does not — the same split `handler()` makes between `event.body`
 * and `event.request`. {@link SocketMessage.raw} is always the frame itself,
 * and the accessors convert it on demand, so a relay that only forwards bytes
 * never pays to decode them.
 */
export interface SocketMessage<T = string | Uint8Array> {
	/**
	 * The payload: the `incoming` schema's output, or the raw frame for a route
	 * that declares no schema.
	 */
	readonly data: T;
	/** The frame exactly as it arrived, whatever {@link SocketMessage.data} was parsed from. */
	readonly raw: string | Uint8Array;
	/** Whether the frame was a binary one. */
	readonly binary: boolean;
	/** The payload as text. Binary payloads are decoded as UTF-8. */
	text(): string;
	/**
	 * The payload parsed as JSON. Throws on a payload that is not JSON.
	 *
	 * The type argument is the caller stating what it expects — the wire carries
	 * no proof of it, exactly as it carries none for an `sse` frame's `data`.
	 */
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- The parameter is the caller's claim about the payload; there is nothing else in the signature for it to relate to.
	json<T = unknown>(): T;
	uint8Array(): Uint8Array;
	arrayBuffer(): ArrayBuffer;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * A message over a payload the transport handed up. `parsed` is what the
 * `incoming` schema made of it; without a schema the raw payload is the
 * payload, which is what the default type parameter says.
 */
export function socketMessage<T = string | Uint8Array>(
	raw: string | Uint8Array,
	parsed?: T,
): SocketMessage<T> {
	const data = raw;
	const binary = typeof data !== "string";
	return {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- With no schema the raw payload *is* the payload, which is what `T`'s default says; with one, `parsed` is the schema's own output.
		data: (parsed === undefined ? raw : parsed) as T,
		raw,
		binary,
		text: () => (typeof data === "string" ? data : decoder.decode(data)),
		// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Implements the interface above, whose type parameter is the caller's claim.
		json<T>(): T {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The payload's type is the caller's claim about it; the wire carries no proof either way.
			return JSON.parse(typeof data === "string" ? data : decoder.decode(data)) as T;
		},
		uint8Array: () => (typeof data === "string" ? encoder.encode(data) : data),
		arrayBuffer: () => toArrayBuffer(typeof data === "string" ? encoder.encode(data) : data),
	};
}

/** The bytes as their own buffer, so a slice of a pooled one is never handed out. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}

// ---------------------------------------------------------------------------
// Peers
// ---------------------------------------------------------------------------

/** Why a connection ended, as the close frame reported it. */
export type SocketCloseDetails = {
	/** The [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code), or `1006` when the socket died without one. */
	code: number;
	reason: string;
	/** Whether the close handshake completed rather than the socket simply dying. */
	clean: boolean;
};

/**
 * One connected client. It is what a socket handler holds on to: send through
 * it, close it, watch {@link SocketPeer.signal} to know when it is gone.
 */
export interface SocketPeer<Params = Record<string, string>, Outgoing = SocketData> {
	/**
	 * A per-connection id, unique within this process. Two connections from the
	 * same client are two peers, which is the point — it is the key to hang
	 * per-connection state off.
	 */
	readonly id: string;
	/** The route's params, under the `params` schema's output where one is declared. */
	readonly params: Params;
	/** The URL the upgrade was requested at, query string included. */
	readonly url: URL;
	/** The upgrade request, for its headers — `sec-websocket-protocol`, a bearer token. */
	readonly request: Request;
	/** Whatever `hooks.server.ts` put on the event that accepted this upgrade. */
	readonly locals: App.Locals;
	/**
	 * Aborts when the connection is gone, however it went. This is what a source
	 * feeding the peer should be waiting under: a loop parked on a promise that
	 * never settles outlives the client it was writing to.
	 */
	readonly signal: AbortSignal;
	readonly readyState: SocketReadyState;
	/**
	 * Bytes handed to {@link SocketPeer.send} that the transport has not written
	 * out yet — the flow-control signal. A host that cannot report it says `0`
	 * always; see {@link SocketPeer.drained}.
	 */
	readonly bufferedAmount: number;
	/**
	 * Queues a message. Returns {@link SocketPeer.bufferedAmount} as it stands
	 * after queueing, so a producer can decide to wait without a second read.
	 * Sending on a closed peer is a no-op rather than an error — the client
	 * going away is not the sender's bug.
	 *
	 * With an `outgoing` schema this takes the value that schema describes and
	 * serializes it as JSON; without one it takes a string or bytes and sends
	 * them as they are.
	 */
	send(data: Outgoing): number;
	/**
	 * Queues a raw frame, whatever the route's `outgoing` schema says — the
	 * escape hatch for the binary half of a protocol whose text half is typed.
	 */
	sendRaw(data: SocketData): number;
	/** Starts the close handshake. Closing an already-closed peer does nothing. */
	close(code?: number, reason?: string): void;
	/**
	 * Resolves once {@link SocketPeer.bufferedAmount} is at or under `limit` —
	 * the backpressure primitive. Resolves immediately when it already is, and
	 * when the peer closes, so a producer awaiting it is never stranded.
	 *
	 * ```ts
	 * for await (const chunk of source) {
	 * 	if (peer.send(chunk) > 1_000_000) await peer.drained(1_000_000);
	 * }
	 * ```
	 *
	 * On a host with no buffer to report — Cloudflare's `WebSocket` has none —
	 * this always resolves at once, so flow control there has to be a credit
	 * scheme over the channel itself rather than a read of the socket.
	 */
	drained(limit?: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// The handler a route declares
// ---------------------------------------------------------------------------

/**
 * The event a route's `upgrade` hook receives: the request event, with
 * `params` as the route bound them. Returning a `Response` refuses the
 * upgrade and sends that response instead; `error(401, …)` does the same
 * through the pipeline.
 */
export type SocketUpgradeEvent<Params = Record<string, string>> = Omit<RequestEvent, "params"> & {
	params: Params;
};

/**
 * What a route does with a connection, one callback per thing that happens to
 * it. `Incoming` and `Outgoing` are what the route's schemas describe; a route
 * that declares neither gets the raw frame and sends raw frames back.
 */
export type SocketHandlers<
	Params = Record<string, string>,
	Incoming = string | Uint8Array,
	Outgoing = SocketData,
> = {
	/**
	 * Runs before the upgrade is accepted, with the app's hooks already applied
	 * — so `event.locals` is filled in and this is where a socket route
	 * authenticates. Refuse by throwing `error(…)` or by returning a `Response`.
	 */
	upgrade?: (event: SocketUpgradeEvent<Params>) => MaybePromise<void | Response>;
	/**
	 * The connection is open and may be written to.
	 *
	 * This and the three below return `unknown` rather than `void`: nothing reads
	 * what they return — a promise is awaited, and anything else is dropped — and
	 * `void` would refuse the one-line arrow that is the common case, since
	 * `peer.send()` answers with what is still queued.
	 */
	open?: (peer: SocketPeer<Params, Outgoing>) => MaybePromise<unknown>;
	/**
	 * One message arrived. Calls are sequenced: a slow handler holds the next
	 * message, so a frame that sets up state cannot be overtaken by the frame
	 * that uses it.
	 *
	 * Runs for every message, `on` or no `on` — which is what makes it the place
	 * to log or count them while `on` does the dispatching.
	 */
	message?: (
		peer: SocketPeer<Params, Outgoing>,
		message: SocketMessage<Incoming>,
	) => MaybePromise<unknown>;
	/** The connection is gone. This is where per-connection state is released. */
	close?: (
		peer: SocketPeer<Params, Outgoing>,
		details: SocketCloseDetails,
	) => MaybePromise<unknown>;
	/**
	 * Something threw — the transport, one of the callbacks above, or a message
	 * the `incoming` schema rejected. Without one, the error goes to the same
	 * reporter an endpoint's would.
	 */
	error?: (peer: SocketPeer<Params, Outgoing>, error: unknown) => MaybePromise<unknown>;
};

/**
 * What `socket()` takes: the callbacks, or a single function that is the
 * `open` callback. The function form is handed the peer and the signal that
 * aborts when it disconnects, so a duplex loop reads as a body:
 *
 * ```ts
 * export const SOCKET = socket(async (peer, signal) => {
 * 	for await (const tick of ticks(signal)) peer.send(tick);
 * });
 * ```
 */
export type SocketSource<Params = Record<string, string>> =
	| SocketHandlers<Params>
	| ((peer: SocketPeer<Params>, signal: AbortSignal) => MaybePromise<unknown>);

/**
 * Type-only phantom key. `socket()` never sets this property — it exists so
 * the generated client can read a route's message contract off the handler's
 * type, exactly as `SPEC` does for an endpoint's operations.
 */
export const SOCKET_SPEC: unique symbol = Symbol.for("@implementjs/kit:socket-spec");

/** Runtime key: what `socket()` marks its result with, so the pipeline can recognize one. */
export const SOCKET_DEFINITION: unique symbol = Symbol.for("@implementjs/kit:socket-definition");

/**
 * The type-level shape of one socket route: what the two ends may send each
 * other. The generated client reads this off the handler and never evaluates
 * the module.
 */
export type SocketSpec = {
	/** What the route binds as `peer.params`. */
	params: unknown;
	/** What a client may send — the `incoming` schema's input. */
	send: unknown;
	/** What a client receives — the `outgoing` schema's output. */
	receive: unknown;
};

/** What `socket()` returns — the callbacks, marked so the pipeline can find them. */
export type SocketHandler<S extends SocketSpec = SocketSpec> = {
	readonly [SOCKET_DEFINITION]: SocketDefinition;
	/** Type-only — see {@link SOCKET_SPEC}. Never read this at runtime. */
	readonly [SOCKET_SPEC]: S;
};

/**
 * The peer as the erased definition sees it, and the reason for the two type
 * arguments below.
 *
 * `Params` reaches a callback as `peer.params`, so erasing it to `never` is
 * what makes a handler expecting concrete params accept this one. `Outgoing`
 * is the *parameter* of `peer.send` — contravariant inside an already
 * contravariant position — so it erases the other way, to `unknown`.
 */
type ErasedPeer = SocketPeer<never, unknown>;

/** The definition as `socket()` holds it, every schema erased. */
export type SocketDefinition = SocketHandlers<never, never, unknown> & {
	params?: StandardSchemaV1;
	incoming?: StandardSchemaV1;
	outgoing?: StandardSchemaV1;
	discriminant?: string;
	on?: Record<string, (peer: ErasedPeer, data: never) => MaybePromise<unknown>>;
};

type Schema = StandardSchemaV1;

/**
 * The four message types a route's two schemas fix, named as type parameters
 * rather than pulled out of the schemas with `InferInput`/`InferOutput`.
 *
 * That is deliberate and load-bearing. A conditional type is not an inference
 * site, so `IS extends Schema ? InferOutput<IS> : …` has to be *resolved*
 * rather than inferred through — and once a second schema is in play the
 * checker gives up on it and falls back to the constraint. Nothing errors: the
 * message type quietly widens to `unknown` and the `on` map stops being
 * exhaustive. Writing `incoming: StandardSchemaV1<Send, Received>` makes both
 * ends ordinary inference sites, which is why the shape below is worth its
 * length.
 *
 * The schema is then the *only* place these come from: the callback side is
 * wrapped in `NoInfer`, because a handler map is an inference site too, and
 * one that offers `unknown` beats one that offers the right answer. The
 * symptom is the same silent widening.
 *
 * `NoInfer` goes *around* the computed type, never inside it: `Extract` has to
 * distribute over the union to key it by its discriminant, and it cannot see
 * through a `NoInfer` wrapper to do that — which produces the third flavour of
 * the same quiet failure, a handler whose payload is `never`.
 *
 * `Send`/`Sent` are a schema's *input* — what a caller writes, since a JSON
 * message travels structurally and a transforming schema receives the input
 * shape, the same reasoning `handler()`'s `body` uses. `Received`/`Handled`
 * are its output.
 */
type NoIncoming = SocketData;
type NoIncomingOutput = string | Uint8Array;
type NoOutgoing = SocketData;
type NoOutgoingOutput = string | Uint8Array;

/** `event.params`: the route's own params, with the `params` schema's output over them. */
type ParamsOf<PS, Fallback> = PS extends Schema
	? Simplify<
			Omit<Fallback, keyof StandardSchemaV1.InferOutput<PS>> & StandardSchemaV1.InferOutput<PS>
		>
	: Fallback;

/** An intersection, flattened — so a hover and an error message read as one object. */
type Simplify<T> = { [K in keyof T]: T[K] };

/** The default discriminant, so the common case names nothing. */
export const DEFAULT_DISCRIMINANT = "type";

/** The members of a union that carry a `D` at all. */
type Tagged<T, D extends PropertyKey> = Extract<T, Record<D, PropertyKey>>;

/**
 * The members of a union keyed by their discriminant.
 *
 * Deliberately not written as `T extends Record<D, …> ? { … } : never`: a
 * naked type parameter in a conditional distributes, so that spelling produces
 * a *union of one-key objects* rather than one object with every key — and
 * `keyof` of such a union is `never`, which silently turns the map below into
 * one that accepts anything.
 */
type ByDiscriminant<T, D extends PropertyKey> = {
	[K in Tagged<T, D>[D]]: Extract<T, Record<D, K>>;
};

/**
 * The `on` map for a tagged union: one handler per member, keyed by the
 * discriminant, each receiving that member narrowed.
 *
 * Every key is required. Adding a message kind to the `incoming` schema is
 * then a build error until it is handled, which is the whole reason to prefer
 * this over a `switch` that silently falls through.
 */
type OnMap<Incoming, D extends PropertyKey, Params, Outgoing> = {
	[K in keyof ByDiscriminant<Incoming, D>]: (
		peer: SocketPeer<Params, Outgoing>,
		data: ByDiscriminant<Incoming, D>[K],
	) => MaybePromise<unknown>;
};

/** The parts every overload shares: the param schema, and the dispatch key. */
type SocketParts<PS, D extends PropertyKey> = {
	/**
	 * Narrows what the route bound — coerce an `[id]` to a number here.
	 * What the schema declares wins; every other param comes through
	 * untouched, exactly as it does for `handler()`.
	 */
	params?: PS;
	/**
	 * The key `on` dispatches an incoming message by.
	 * @default "type"
	 */
	discriminant?: D;
};

/**
 * The `socket` a route's `./$types` exports, pre-bound to that route's params.
 *
 * Three call signatures: the callbacks with an `on` map dispatching a tagged
 * union, the callbacks on their own, or a single function standing in for
 * `open`. The first two may declare `params`, `incoming`, and `outgoing`
 * schemas; see {@link NoIncoming} for why the message types are spelled as
 * type parameters rather than read off the schemas.
 */
export interface SocketBuilder<P extends Record<string, unknown> = Record<string, string>> {
	(
		open: (peer: SocketPeer<P>, signal: AbortSignal) => MaybePromise<unknown>,
	): SocketHandler<{ params: P; send: NoIncoming; receive: NoOutgoingOutput }>;

	<
		Sent = NoIncoming,
		Handled = NoIncomingOutput,
		Sending = NoOutgoing,
		Received = NoOutgoingOutput,
		PS extends Schema | undefined = undefined,
		D extends PropertyKey = typeof DEFAULT_DISCRIMINANT,
	>(
		definition: NoInfer<SocketHandlers<ParamsOf<PS, P>, Handled, Sending>> &
			SocketParts<PS, D> & {
				/**
				 * Validates every message that arrives, and types `message.data` and
				 * the generated client's `send`. A frame the schema rejects is the
				 * peer talking a protocol this route does not speak, so the
				 * connection is closed with `1008` after the route's `error` handler
				 * sees it.
				 */
				incoming?: StandardSchemaV1<Sent, Handled>;
				/**
				 * Types `peer.send` and the generated client's messages, and
				 * serializes what `send` is given as JSON.
				 *
				 * Type-only at runtime, unlike `handler()`'s `response`: `send` is
				 * synchronous because it answers with `bufferedAmount`, and a
				 * Standard Schema may validate asynchronously — making every call
				 * site `await` to re-check what the types already state is a bad
				 * trade. `sendRaw` is the way past it either way.
				 */
				outgoing?: StandardSchemaV1<Sending, Received>;
				/**
				 * One handler per member of the `incoming` union, keyed by the
				 * discriminant — and every member is required, so adding a message
				 * kind to the schema is a build error until it is handled.
				 *
				 * `message`, when it is also declared, runs first and sees every
				 * message; this dispatches the one that matched.
				 */
				on?: NoInfer<OnMap<Handled, D, ParamsOf<PS, P>, Sending>>;
			},
	): SocketHandler<{ params: ParamsOf<PS, P>; send: Sent; receive: Received }>;
}

/**
 * Declares that a route accepts WebSocket upgrades.
 *
 * Import it from the route's `./$types` rather than from here — that copy is
 * bound to the route's own params, so `peer.params` is typed without repeating
 * the pattern — and export the result as `SOCKET`:
 *
 * ```ts
 * // src/routes/api/room/[id]/server.ts
 * import { error, socket } from "./$types";
 *
 * export const SOCKET = socket({
 * 	upgrade: ({ locals }) => {
 * 		if (locals.user === null) error(401, "sign in first");
 * 	},
 * 	open: (peer) => join(peer.params.id, peer),
 * 	message: (peer, message) => broadcast(peer.params.id, message.text()),
 * 	close: (peer) => leave(peer.params.id, peer),
 * });
 * ```
 *
 * Declaring `incoming` and `outgoing` schemas types both directions and, with
 * an `on` map, dispatches a tagged union member by member:
 *
 * ```ts
 * export const SOCKET = socket({
 * 	incoming: ClientMessage,
 * 	outgoing: ServerMessage,
 * 	on: {
 * 		join: (peer, data) => join(peer.params.id, data.user),
 * 		chat: (peer, data) => broadcast(peer.params.id, data.text),
 * 	},
 * });
 * ```
 *
 * A directory serving a socket may still export `GET` and the rest: an upgrade
 * request is routed here, and an ordinary request to the same path is routed
 * to the method handler as usual.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The overloads are the contract; the implementation only ever sees the erased source.
export const socket = ((source: ErasedSource) => buildSocket(source)) as unknown as SocketBuilder;

/** What the implementation sees once the overloads have done their work. */
type ErasedSource =
	| SocketDefinition
	| ((peer: ErasedPeer, signal: AbortSignal) => MaybePromise<unknown>);

function buildSocket(source: ErasedSource): SocketHandler {
	// the function form is the `open` callback and nothing else — it is handed
	// the peer's own teardown signal so a loop can wait under it
	const definition: SocketDefinition =
		typeof source === "function" ? { open: (peer) => source(peer, peer.signal) } : source;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SOCKET_SPEC is a type-only phantom key; the runtime object carries only SOCKET_DEFINITION.
	return { [SOCKET_DEFINITION]: definition } as SocketHandler;
}

/** The definition behind a `socket()` result, or `null` for anything else. */
export function socketDefinition(value: unknown): SocketDefinition | null {
	if (typeof value !== "object" || value === null) return null;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The key is only ever set by buildSocket, to a SocketDefinition.
	const definition = (value as Record<symbol, unknown>)[SOCKET_DEFINITION] as
		| SocketDefinition
		| undefined;
	return definition ?? null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type SocketMatch = {
	route: EndpointRoute;
	params: Record<string, unknown>;
	definition: SocketDefinition;
};

/**
 * The route that would accept an upgrade at `path`, or `null` when none does.
 *
 * The same table endpoints are matched against, since a socket is declared by
 * the `server.ts` already serving that path: the most specific route owns the
 * path, and one that declares no `SOCKET` simply does not accept upgrades —
 * kit does not fall through to a broader route for it, any more than a missing
 * `POST` falls through to another route's.
 */
export function matchSocket(
	endpoints: EndpointRoute[],
	path: string,
	matchers: MatcherMode,
): SocketMatch | null {
	const match = matchEndpoint(endpoints, normalizeRoutePath(path), matchers);
	if (match === null) return null;
	const declared = match.route.module[SOCKET_EXPORT];
	if (declared === undefined) return null;
	const definition = socketDefinition(declared);
	if (definition === null) {
		throw new Error(
			`"${match.route.file}" exports ${SOCKET_EXPORT}, but it is not a socket() handler — wrap it: \`export const ${SOCKET_EXPORT} = socket({ … })\`.`,
		);
	}
	return { route: match.route, params: match.params, definition };
}

/** Whether a request is asking to be upgraded to a WebSocket. */
export function isUpgradeRequest(request: Request): boolean {
	if (request.method !== "GET") return false;
	// both headers are comma-separated lists, and `Connection` legitimately
	// carries more than one token — a proxy may have added `keep-alive`
	const connection = request.headers.get("connection") ?? "";
	const upgrade = request.headers.get("upgrade") ?? "";
	return (
		connection
			.toLowerCase()
			.split(",")
			.some((token) => token.trim() === "upgrade") && upgrade.toLowerCase().trim() === "websocket"
	);
}

/**
 * Runs the `params` schema of a socket route, if it declares one. A rejection
 * is a `400` through {@link error}, exactly as it is for `handler()` — the
 * handshake never completes and the client sees the status.
 */
export async function validateSocketParams(
	definition: SocketDefinition,
	params: Record<string, unknown>,
): Promise<unknown> {
	if (definition.params === undefined) return params;
	const result = await definition.params["~standard"].validate(params);
	if (result.issues !== undefined) {
		error(400, `invalid params — ${formatSchemaIssues(result.issues)}`);
	}
	const validated = result.value;
	// an object schema drops the keys it was not told about, so a schema for one
	// param would otherwise take the route's other params with it
	if (typeof validated !== "object" || validated === null || Array.isArray(validated)) {
		return validated;
	}
	return { ...params, ...validated };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * What an adapter provides: the transport, reduced to what a peer needs of it.
 * A Node socket behind `./websocket.ts` is one; a worker's accepted
 * `WebSocket` is another.
 */
export type SocketConnection = {
	send(data: string | Uint8Array): void;
	close(code?: number, reason?: string): void;
	/** Bytes queued but not yet written, or `0` on a transport that cannot say. */
	readonly bufferedAmount: number;
	readonly readyState: number;
};

/**
 * What an adapter drives: one call per thing that happened to the transport.
 * Every callback the route declared runs from here, sequenced, with whatever
 * they throw reported once.
 */
export type SocketSession = {
	readonly peer: SocketPeer<unknown>;
	/** The connection is open. Runs the route's `open`. */
	open(): void;
	/** A frame arrived. Runs the route's `message`, after any still running. */
	message(data: string | Uint8Array): void;
	/** The connection ended. Runs the route's `close` and aborts the peer's signal. */
	closed(details?: Partial<SocketCloseDetails>): void;
	/** The transport failed. Runs the route's `error`. */
	failed(error: unknown): void;
	/** The transport's buffer drained — wakes anything waiting on {@link SocketPeer.drained}. */
	drained(): void;
};

export type SocketSessionOptions = {
	definition: SocketDefinition;
	connection: SocketConnection;
	/** The event the upgrade was accepted on — its locals, url, request, and params. */
	event: RequestEvent;
	/** The params the route bound, under its `params` schema where it declares one. */
	params: unknown;
	/** Called with anything a callback threw that the route's own `error` did not take. */
	onError?: (error: unknown) => void;
};

let counter = 0;

/** A per-process connection id. Short, unique, and not a token — see {@link SocketPeer.id}. */
function nextPeerId(): string {
	counter += 1;
	return `${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Binds a route's callbacks to one transport.
 *
 * Callbacks are sequenced on a single chain: a `message` handler that awaits
 * holds the next message rather than racing it, and `close` runs after the
 * messages that arrived before it. That is what makes a duplex protocol
 * tractable — a frame that sets up state cannot be overtaken by the frame that
 * uses it.
 */
export function createSocketSession(options: SocketSessionOptions): SocketSession {
	const { definition, connection, event, params, onError } = options;
	const stop = new AbortController();
	/** Resolved and replaced each time the transport reports it drained. */
	let drainWaiters: (() => void)[] = [];
	let closed = false;
	/** The callbacks run one after another; this is the tail of that chain. */
	let queue: Promise<void> = Promise.resolve();

	/** Writes a frame, or answers `0` for a peer that is no longer there. */
	const write = (frame: string | Uint8Array): number => {
		if (closed || connection.readyState !== SocketReadyState.OPEN) return 0;
		try {
			connection.send(frame);
		} catch (error) {
			// a socket that died between the readyState read and the write is the
			// client going away, which is not the sender's bug — but it is worth
			// the one report the route's `error` exists for
			report(error);
			return 0;
		}
		return connection.bufferedAmount;
	};

	const peer: ErasedPeer = {
		id: nextPeerId(),
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Params are typed per route through `./$types`; the erased peer has no way to name them.
		params: params as never,
		url: event.url,
		request: event.request,
		locals: event.locals,
		signal: stop.signal,
		get readyState(): SocketReadyState {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The transport reports the four states `WebSocket` defines.
			return connection.readyState as SocketReadyState;
		},
		get bufferedAmount(): number {
			return connection.bufferedAmount;
		},
		// with an `outgoing` schema the argument is the value that schema
		// describes, and JSON is what the wire carries it as; without one it is
		// already a frame
		send: (data) =>
			write(
				definition.outgoing === undefined
					? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- With no `outgoing` schema the type says this is already a frame.
						normalizeSend(data as SocketData)
					: JSON.stringify(data),
			),
		sendRaw: (data) => write(normalizeSend(data)),
		close: (code, reason) => {
			if (closed) return;
			try {
				connection.close(code, reason);
			} catch (error) {
				report(error);
			}
		},
		drained: async (limit = 0) => {
			// re-read on every pass: `closed` and the buffer both move underneath
			// this, which is the whole reason it is waiting
			for (;;) {
				if (closed || connection.bufferedAmount <= limit) return;
				await new Promise<void>((resolve) => drainWaiters.push(resolve));
			}
		},
	};

	/** Anything a callback threw: the route's `error` first, then the reporter. */
	const report = (error: unknown): void => {
		if (definition.error === undefined) {
			onError?.(error);
			return;
		}
		try {
			const result = definition.error(peer, error);
			// a rejecting `error` handler has nowhere left to go but the reporter
			if (result instanceof Promise) result.catch((nested) => onError?.(nested));
		} catch (nested) {
			onError?.(nested);
		}
	};

	/** Appends a callback to the chain, so nothing overtakes what came before it. */
	const enqueue = (run: () => MaybePromise<unknown>): void => {
		queue = queue.then(async () => {
			try {
				await run();
			} catch (error) {
				report(error);
			}
		});
	};

	const wake = (): void => {
		const waiters = drainWaiters;
		drainWaiters = [];
		for (const resolve of waiters) resolve();
	};

	return {
		peer,
		open: () => {
			if (definition.open === undefined) return;
			enqueue(() => definition.open!(peer));
		},
		message: (data) => {
			if (definition.message === undefined && definition.on === undefined) return;
			enqueue(async () => {
				let message: SocketMessage<never>;
				try {
					message = await parseMessage(definition, data);
				} catch (invalid) {
					// the peer is talking a protocol this route does not speak, and
					// carrying on would mean acting on what the wire just contradicted
					report(invalid);
					peer.close(CLOSE_UNSUPPORTED_DATA, "message rejected by the route's schema");
					return;
				}
				// `message` sees everything, `on` dispatches — so a route can log or
				// count every frame and still handle them one kind at a time
				await definition.message?.(peer, message);
				await dispatch(definition, peer, message.data);
			});
		},
		closed: (details = {}) => {
			if (closed) return;
			closed = true;
			const full: SocketCloseDetails = {
				code: details.code ?? 1006,
				reason: details.reason ?? "",
				clean: details.clean ?? false,
			};
			// woken before the close callback runs, so a producer parked on
			// backpressure stops waiting on a socket that is already gone
			wake();
			if (definition.close !== undefined) enqueue(() => definition.close!(peer, full));
			// aborted last, so the route's own `close` sees the peer before anything
			// waiting on the signal starts tearing its state down
			enqueue(() => {
				stop.abort();
			});
		},
		failed: (error) => {
			report(error);
		},
		drained: wake,
	};
}

/**
 * The close code for a message a route's `incoming` schema rejected — the one
 * the protocol reserves for "the peer sent data this endpoint cannot accept".
 */
const CLOSE_UNSUPPORTED_DATA = 1008;

/** A message the `incoming` schema refused, with every issue the schema named. */
export class SocketMessageError extends Error {
	constructor(issues: string) {
		super(`invalid message — ${issues}`);
		this.name = "SocketMessageError";
	}
}

/**
 * One frame as the route's callbacks see it: parsed as JSON and validated
 * where the route declares an `incoming` schema, and handed over untouched
 * where it does not.
 *
 * @throws {SocketMessageError} when the schema rejects it, or when a route
 * that declares one is sent something that is not JSON at all.
 */
async function parseMessage(
	definition: SocketDefinition,
	raw: string | Uint8Array,
): Promise<SocketMessage<never>> {
	// erased to `never` on the way out: this is the boundary between a runtime
	// payload and callbacks whose own types the route's schemas decided
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The route's `incoming` schema is what says which type this is; the erased definition cannot name it.
	const erase = (message: SocketMessage<unknown>) => message as SocketMessage<never>;
	const schema = definition.incoming;
	if (schema === undefined) return erase(socketMessage(raw));
	const message = socketMessage(raw);
	let payload: unknown;
	try {
		payload = message.json();
	} catch {
		throw new SocketMessageError("not valid JSON");
	}
	const result = await schema["~standard"].validate(payload);
	if (result.issues !== undefined) {
		throw new SocketMessageError(formatSchemaIssues(result.issues));
	}
	return erase(socketMessage(raw, result.value));
}

/** Hands a validated message to the `on` entry its discriminant names, if there is one. */
async function dispatch(
	definition: SocketDefinition,
	peer: ErasedPeer,
	data: unknown,
): Promise<void> {
	const { on } = definition;
	if (on === undefined || typeof data !== "object" || data === null) return;
	const key = definition.discriminant ?? DEFAULT_DISCRIMINANT;
	if (!(key in data)) return;
	const tag: unknown = Reflect.get(data, key);
	if (typeof tag !== "string" && typeof tag !== "number") return;
	// the map is exhaustive over the schema's own union, so a miss here is a
	// value the schema accepted and the map has no member for — nothing to do
	// but leave it to `message`, which has already seen it
	const handler = on[String(tag)];
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The map is keyed by the union's discriminant, so a hit is that member.
	await handler?.(peer, data as never);
}

/** Whatever a caller passed to `send`, as the transport wants it. */
function normalizeSend(data: SocketData): string | Uint8Array {
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) return data;
	if (ArrayBuffer.isView(data)) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	}
	return new Uint8Array(data);
}
