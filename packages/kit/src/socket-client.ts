/**
 * The client half of a socket route: what `api.SOCKET(path, …)` hands back.
 *
 * ```ts
 * const room = api.SOCKET("/api/room/[id]", { params: { id } });
 *
 * room.send({ type: "chat", text });          // the route's `incoming` schema
 * for await (const message of room) { … }     // its `outgoing` schema
 * ```
 *
 * Three things this does that `new WebSocket(url)` does not, and they are the
 * reason it exists at all: it builds the URL from the route's params, it
 * reconnects (a `WebSocket` never has, unlike `EventSource`), and it exposes
 * `status` as a readable so a connection indicator is one binding rather than
 * a listener and a piece of state.
 *
 * Reconnection is deliberately *not* transparent — see
 * {@link SocketClientOptions.reconnect}.
 */

import { signal, type Readable } from "@implementjs/core";
import { buildUrl } from "./client.ts";
import { SocketReadyState, type SocketData } from "./socket.ts";

/** Where a connection is in its life, as something a template can bind to. */
export type SocketStatus =
	/** Reaching for the server: the first attempt, or one after a drop. */
	| "connecting"
	/** Connected, and messages sent now go out now. */
	| "open"
	/** Gone for good — the server refused it, the caller closed it, or the retries ran out. */
	| "closed";

/** Why a connection ended, as the client sees it. */
export type SocketClientClose = {
	code: number;
	reason: string;
	clean: boolean;
};

export type SocketReconnectOptions = {
	/**
	 * How many times to retry before giving up and settling on `"closed"`.
	 * @default 10
	 */
	retries?: number;
	/** Milliseconds before the first retry, doubling up to {@link SocketReconnectOptions.maxDelay}. @default 500 */
	delay?: number;
	/** The ceiling on that backoff. @default 10_000 */
	maxDelay?: number;
};

export type SocketClientOptions<Send = unknown, Receive = unknown> = {
	/** Prefixed to the route key, as it is for an HTTP call. */
	baseUrl?: string;
	/** Subprotocols to offer, as the `WebSocket` constructor takes them. */
	protocols?: string | string[];
	/**
	 * Reconnect after a drop, or `false` to stay closed.
	 *
	 * **Reconnecting is not transparent, and this deliberately does not pretend
	 * otherwise.** A message queued while the socket was down is dropped rather
	 * than replayed: silently re-sending a `join` after a gap is a correctness
	 * bug, not a convenience. Whatever the connection had established
	 * server-side is gone with it, so watch {@link SocketClient.status} or use
	 * {@link SocketClientOptions.onReconnect} to establish it again.
	 *
	 * @default { retries: 10, delay: 500, maxDelay: 10_000 }
	 */
	reconnect?: SocketReconnectOptions | false;
	/**
	 * Runs on every connection *after* the first, before anything queued behind
	 * it — the place to re-send whatever the last connection had set up.
	 *
	 * A per-call handler is handed the route's own connection, typed by its
	 * schemas; one set as a client-wide default is handed `unknown` both ways,
	 * since a default cannot know which route it will run for.
	 */
	onReconnect?: (client: SocketClient<Send, Receive>) => void;
	/** Ends the connection when it aborts, retries and all. */
	signal?: AbortSignal;
	/** What actually opens the socket. @default globalThis.WebSocket */
	WebSocket?: typeof globalThis.WebSocket;
};

/**
 * One connection to a socket route, typed by that route's schemas.
 *
 * Reading is an async iteration, the same way the generated client reads an
 * `sse` response back — `for await (const message of connection)`. `onMessage`
 * is the callback form for code that cannot await; use one or the other on a
 * given connection, since a message goes to whichever asked for it first.
 */
export interface SocketClient<Send, Receive> extends AsyncIterable<Receive> {
	/** Where the connection is, as a readable — bind it, or read it with `.get()`. */
	readonly status: Readable<SocketStatus>;
	/**
	 * Resolves the first time the socket opens, and rejects when the first
	 * attempt is refused — which is where a `401` from the route's `upgrade`
	 * hook surfaces, as far as a browser lets it.
	 */
	readonly opened: Promise<void>;
	/** Bytes queued but not yet written, as the browser reports them. */
	readonly bufferedAmount: number;
	/**
	 * Sends a message. Returns {@link SocketClient.bufferedAmount} after
	 * queueing, so a producer can decide to wait without a second read.
	 *
	 * Sending while the socket is down is a no-op: see
	 * {@link SocketClientOptions.reconnect} for why nothing is queued for later.
	 */
	send(message: Send): number;
	/** Sends a frame as-is, whatever the route's `outgoing` schema says. */
	sendRaw(data: SocketData): number;
	/** Every message, as a callback. Returns the function that stops it. */
	onMessage(listener: (message: Receive) => void): () => void;
	/** Every close, retried or final. Returns the function that stops it. */
	onClose(listener: (details: SocketClientClose) => void): () => void;
	/** Closes for good: no retry follows this, whatever `reconnect` says. */
	close(code?: number, reason?: string): void;
}

const DEFAULT_RECONNECT: Required<SocketReconnectOptions> = {
	retries: 10,
	delay: 500,
	maxDelay: 10_000,
};

/** `http:` → `ws:`, `https:` → `wss:`, and a relative URL against the page. */
export function socketUrl(url: string): string {
	if (url.startsWith("ws:") || url.startsWith("wss:")) return url;
	const base = globalThis.location?.href;
	// on a server there is no page to resolve against, and a relative socket URL
	// is not something a caller can have meant
	if (!/^https?:/.test(url) && base === undefined) {
		throw new Error(
			`cannot open a socket at "${url}": a relative URL needs a page to resolve against, and there is none here. Pass an absolute \`baseUrl\` to createClient().`,
		);
	}
	const absolute = new URL(url, base);
	absolute.protocol = absolute.protocol === "https:" ? "wss:" : "ws:";
	return absolute.href;
}

/**
 * Opens a connection to a socket route.
 *
 * The generated client calls this; an app reaches it through
 * `api.SOCKET(path, options)`, which is where the path and its params are
 * typed.
 */
export function createSocketClient<Send, Receive>(
	path: string,
	input: { params?: Record<string, unknown>; query?: Record<string, unknown> } | undefined,
	options: SocketClientOptions<Send, Receive> = {},
): SocketClient<Send, Receive> {
	const url = socketUrl(buildUrl(path, input?.params, input?.query, options.baseUrl));
	const retry = options.reconnect === false ? null : { ...DEFAULT_RECONNECT, ...options.reconnect };
	const Socket = options.WebSocket ?? globalThis.WebSocket;
	if (Socket === undefined) {
		throw new Error(
			"no WebSocket implementation: pass one as `WebSocket` to createClient({ socket }). Node has had a global since 22; older ones need `ws`.",
		);
	}

	const status = signal<SocketStatus>("connecting");
	const messageListeners = new Set<(message: Receive) => void>();
	const closeListeners = new Set<(details: SocketClientClose) => void>();
	/** Readers parked in `for await`, oldest first. */
	const readers: ((result: IteratorResult<Receive>) => void)[] = [];
	/** Messages that arrived with nobody reading yet. */
	const pending: Receive[] = [];

	let socket: WebSocket | null = null;
	let attempts = 0;
	let connections = 0;
	let done = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let settleOpened: (() => void) | undefined;
	let failOpened: ((error: unknown) => void) | undefined;
	const opened = new Promise<void>((resolve, reject) => {
		settleOpened = resolve;
		failOpened = reject;
	});
	// nothing may be awaiting it yet, and an unhandled rejection on a promise
	// the caller never asked for is noise rather than news
	opened.catch(() => undefined);

	const client: SocketClient<Send, Receive> = {
		status,
		opened,
		get bufferedAmount() {
			return socket?.bufferedAmount ?? 0;
		},
		send: (message) => write(JSON.stringify(message)),
		sendRaw: (data) => write(data),
		onMessage: (listener) => {
			messageListeners.add(listener);
			return () => messageListeners.delete(listener);
		},
		onClose: (listener) => {
			closeListeners.add(listener);
			return () => closeListeners.delete(listener);
		},
		close: (code, reason) => finish(code, reason),
		[Symbol.asyncIterator]: () => ({
			next: () =>
				new Promise<IteratorResult<Receive>>((resolve) => {
					const next = pending.shift();
					if (next !== undefined) return resolve({ value: next, done: false });
					if (done) return resolve({ value: undefined, done: true });
					readers.push(resolve);
				}),
			// a `break` out of the loop closes the connection, exactly as it ends
			// an `sse` stream
			return: () => {
				finish();
				return Promise.resolve({ value: undefined, done: true });
			},
		}),
	};

	function write(frame: string | SocketData): number {
		if (socket === null || socket.readyState !== SocketReadyState.OPEN) return 0;
		if (typeof frame === "string" || frame instanceof ArrayBuffer) {
			socket.send(frame);
		} else {
			// copied rather than viewed: `send` will not take a view over a buffer
			// that might be shared, and this is the escape-hatch path anyway
			socket.send(new Uint8Array(new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength)));
		}
		return socket.bufferedAmount;
	}

	function deliver(message: Receive): void {
		for (const listener of messageListeners) listener(message);
		const reader = readers.shift();
		if (reader === undefined) {
			// only buffered while something might still read it: with listeners and
			// no iterator, an unbounded queue nobody drains is a leak
			if (messageListeners.size === 0) pending.push(message);
			return;
		}
		reader({ value: message, done: false });
	}

	/** Ends the connection for good — no retry follows, whatever `reconnect` says. */
	function finish(code?: number, reason?: string): void {
		if (done) return;
		done = true;
		if (timer !== undefined) clearTimeout(timer);
		status.set("closed");
		socket?.close(code, reason);
		socket = null;
		for (const reader of readers.splice(0)) reader({ value: undefined, done: true });
	}

	function connect(): void {
		if (done) return;
		attempts += 1;
		status.set("connecting");
		const current = new Socket(url, options.protocols ?? []);
		socket = current;
		current.binaryType = "arraybuffer";

		current.addEventListener("open", () => {
			attempts = 0;
			connections += 1;
			status.set("open");
			settleOpened?.();
			// after the first: whatever the last connection established is gone,
			// and this is where the app puts it back
			if (connections > 1) options.onReconnect?.(client);
		});

		current.addEventListener("message", (event: MessageEvent) => {
			deliver(decode<Receive>(event.data));
		});

		current.addEventListener("close", (event: CloseEvent) => {
			if (socket !== current) return;
			socket = null;
			const details: SocketClientClose = {
				code: event.code,
				reason: event.reason,
				clean: event.wasClean,
			};
			for (const listener of closeListeners) listener(details);
			if (done) return;
			// the very first attempt never connected: that is a refused handshake,
			// and the app asked about it through `opened`
			if (connections === 0 && retry === null) {
				failOpened?.(new Error(`could not open a socket at ${url}`));
			}
			if (retry === null || attempts > retry.retries) {
				if (connections === 0) {
					failOpened?.(new Error(`could not open a socket at ${url}`));
				}
				finish();
				return;
			}
			status.set("connecting");
			const wait = Math.min(retry.delay * 2 ** (attempts - 1), retry.maxDelay);
			timer = setTimeout(connect, wait);
			// a pending retry is not a reason for a process to stay up
			(timer as { unref?: () => void }).unref?.();
		});
	}

	options.signal?.addEventListener("abort", () => finish(1000, "aborted"), { once: true });
	connect();
	return client;
}

/**
 * A frame as the route's `outgoing` schema describes it: JSON where the frame
 * is text, and the bytes themselves where it is binary — the mirror of what
 * `peer.send` did to it.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- The route's `outgoing` schema is the claim about what a frame carries; there is nothing else in the signature to relate it to.
function decode<T>(data: unknown): T {
	if (typeof data === "string") {
		try {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The route's `outgoing` schema is what says this type; the wire carries no proof.
			return JSON.parse(data) as T;
		} catch {
			// a route sending plain text rather than JSON is not an error here —
			// it is a route with no `outgoing` schema, whose type says `string`
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- As above: an untyped route's frames are its own business.
			return data as T;
		}
	}
	if (data instanceof ArrayBuffer) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A binary frame reaches an untyped route, whose type says `Uint8Array`.
		return new Uint8Array(data) as T;
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Whatever the host handed over; nothing here can narrow it further.
	return data as T;
}
