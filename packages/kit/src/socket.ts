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
 * One message, as it arrived. The payload is kept in the form the frame
 * carried it — a text frame is a string, a binary frame is bytes — and the
 * accessors convert on demand, so a relay that only forwards bytes never pays
 * to decode them.
 */
export interface SocketMessage {
	/** The payload exactly as the frame carried it. */
	readonly data: string | Uint8Array;
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

/** A message over a payload the transport handed up. */
export function socketMessage(data: string | Uint8Array): SocketMessage {
	const binary = typeof data !== "string";
	return {
		data,
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
export interface SocketPeer<Params = Record<string, string>> {
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
	 */
	send(data: SocketData): number;
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

/** What a route does with a connection, one callback per thing that happens to it. */
export type SocketHandlers<Params = Record<string, string>> = {
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
	open?: (peer: SocketPeer<Params>) => MaybePromise<unknown>;
	/** One message arrived. Calls are sequenced: a slow handler holds the next message. */
	message?: (peer: SocketPeer<Params>, message: SocketMessage) => MaybePromise<unknown>;
	/** The connection is gone. This is where per-connection state is released. */
	close?: (peer: SocketPeer<Params>, details: SocketCloseDetails) => MaybePromise<unknown>;
	/**
	 * Something threw — the transport, or one of the callbacks above. Without
	 * one, the error goes to the same reporter an endpoint's would.
	 */
	error?: (peer: SocketPeer<Params>, error: unknown) => MaybePromise<unknown>;
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

/** The phantom key a {@link socket} handler carries its param type on. */
declare const SOCKET_PARAMS: unique symbol;

/** Runtime key: what `socket()` marks its result with, so the pipeline can recognize one. */
export const SOCKET_DEFINITION: unique symbol = Symbol.for("@implementjs/kit:socket-definition");

/** What `socket()` returns — the callbacks, marked so the pipeline can find them. */
export type SocketHandler<Params = Record<string, string>> = {
	readonly [SOCKET_DEFINITION]: SocketDefinition;
	/** Type-only — the params the route binds. Never read this at runtime. */
	readonly [SOCKET_PARAMS]?: Params;
};

/** The definition as `socket()` holds it, every schema erased. */
export type SocketDefinition = SocketHandlers<unknown> & { params?: StandardSchemaV1 };

type Schema = StandardSchemaV1;

/** `event.params`: the route's own params, with the `params` schema's output over them. */
type ParamsOf<PS, Fallback> = PS extends Schema
	? Simplify<
			Omit<Fallback, keyof StandardSchemaV1.InferOutput<PS>> & StandardSchemaV1.InferOutput<PS>
		>
	: Fallback;

/** An intersection, flattened — so a hover and an error message read as one object. */
type Simplify<T> = { [K in keyof T]: T[K] };

/**
 * The `socket` a route's `./$types` exports, pre-bound to that route's params.
 * Two call signatures: the callbacks, optionally with a `params` schema
 * narrowing what the route bound, or a single function standing in for `open`.
 */
export interface SocketBuilder<P extends Record<string, unknown> = Record<string, string>> {
	<PS extends Schema | undefined = undefined>(
		definition: SocketHandlers<ParamsOf<PS, P>> & {
			/**
			 * Narrows what the route bound — coerce an `[id]` to a number here.
			 * What the schema declares wins; every other param comes through
			 * untouched, exactly as it does for `handler()`.
			 */
			params?: PS;
		},
	): SocketHandler<ParamsOf<PS, P>>;

	(open: (peer: SocketPeer<P>, signal: AbortSignal) => MaybePromise<unknown>): SocketHandler<P>;
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
 * A directory serving a socket may still export `GET` and the rest: an upgrade
 * request is routed here, and an ordinary request to the same path is routed
 * to the method handler as usual.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The overloads are the contract; the implementation only ever sees the erased source.
export const socket = ((source: SocketSource<unknown>) => buildSocket(source)) as SocketBuilder;

function buildSocket(source: SocketSource<unknown>): SocketHandler {
	// the function form is the `open` callback and nothing else — it is handed
	// the peer's own teardown signal so a loop can wait under it
	const definition: SocketDefinition =
		typeof source === "function" ? { open: (peer) => source(peer, peer.signal) } : source;
	return { [SOCKET_DEFINITION]: definition };
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

	const peer: SocketPeer<unknown> = {
		id: nextPeerId(),
		params,
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
		send: (data) => {
			if (closed || connection.readyState !== SocketReadyState.OPEN) return 0;
			try {
				connection.send(normalizeSend(data));
			} catch (error) {
				// a socket that died between the readyState read and the write is the
				// client going away, which is not the sender's bug — but it is worth
				// the one report the route's `error` exists for
				report(error);
				return 0;
			}
			return connection.bufferedAmount;
		},
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
			if (definition.message === undefined) return;
			const message = socketMessage(data);
			enqueue(() => definition.message!(peer, message));
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

/** Whatever a caller passed to `send`, as the transport wants it. */
function normalizeSend(data: SocketData): string | Uint8Array {
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) return data;
	if (ArrayBuffer.isView(data)) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	}
	return new Uint8Array(data);
}
