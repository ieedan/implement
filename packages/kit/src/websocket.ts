/**
 * The WebSocket wire protocol over a Node socket: the handshake, RFC 6455
 * framing, and the connection object `./socket.ts` drives a session with.
 *
 * It is here rather than in a dependency because the transport is the only
 * platform-specific half of kit's socket support — Cloudflare hands the app an
 * accepted `WebSocket` and there is no framing to do — and because a server
 * frame reader is a small, closed piece of work: parse frames, unmask them,
 * reassemble fragments, answer pings, and hold the close handshake open long
 * enough to be polite about it.
 *
 * Node-only: this module reaches for `node:crypto` and a `node:stream` duplex,
 * so it is imported by `./node.ts` and by nothing that runs in a worker.
 *
 * Not implemented on purpose: `permessage-deflate`. Kit never negotiates an
 * extension, so a client that offers one falls back to uncompressed frames,
 * which is what the protocol says to do.
 */

import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { SocketReadyState, type SocketConnection } from "./socket.ts";

/** The constant the handshake hashes the client's key with, from RFC 6455 §1.3. */
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * The socket a `node:http` `upgrade` event hands over. Node types it as a
 * plain `Duplex`, and it is a `net.Socket` in every deployment that matters —
 * the two tuning knobs below are declared optional so both are accepted and
 * neither is assumed.
 */
export type UpgradeSocket = Duplex & {
	setNoDelay?: (noDelay?: boolean) => void;
	setTimeout?: (timeout: number) => void;
};

export const OPCODE = {
	CONTINUATION: 0x0,
	TEXT: 0x1,
	BINARY: 0x2,
	CLOSE: 0x8,
	PING: 0x9,
	PONG: 0xa,
} as const;

/** Close codes kit sends on its own behalf. */
export const CLOSE_CODE = {
	NORMAL: 1000,
	GOING_AWAY: 1001,
	PROTOCOL_ERROR: 1002,
	UNSUPPORTED: 1003,
	/** Never sent on the wire — what a socket that died without a close frame reports. */
	ABNORMAL: 1006,
	POLICY: 1008,
	TOO_LARGE: 1009,
	INTERNAL: 1011,
} as const;

/** A frame that broke the protocol, carrying the close code the peer should get. */
export class WebSocketProtocolError extends Error {
	readonly code: number;

	constructor(message: string, code: number = CLOSE_CODE.PROTOCOL_ERROR) {
		super(message);
		this.name = "WebSocketProtocolError";
		this.code = code;
	}
}

// ---------------------------------------------------------------------------
// The handshake
// ---------------------------------------------------------------------------

/** `Sec-WebSocket-Accept` for a client's `Sec-WebSocket-Key`. */
export function acceptKey(key: string): string {
	return createHash("sha1")
		.update(key + GUID)
		.digest("base64");
}

/**
 * Why an upgrade request is not one, or `null` when it is well-formed.
 *
 * Checked before the app's pipeline runs: a malformed handshake is not a
 * request the app has anything to say about, and answering it with the app's
 * 404 page would be a strange thing to send down a socket that asked for a
 * protocol switch.
 */
export function handshakeProblem(req: IncomingMessage): string | null {
	if ((req.method ?? "GET") !== "GET") return "a WebSocket upgrade must be a GET";
	const version = header(req, "sec-websocket-version");
	if (version !== "13") {
		return `unsupported Sec-WebSocket-Version "${version ?? ""}" — kit speaks 13`;
	}
	const key = header(req, "sec-websocket-key");
	if (key === undefined || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
		return "missing or malformed Sec-WebSocket-Key";
	}
	return null;
}

function header(req: IncomingMessage, name: string): string | undefined {
	const value = req.headers[name];
	return Array.isArray(value) ? value[0] : value;
}

/**
 * Completes the handshake: writes the `101` and hands back the connection the
 * session is driven through. Any headers the pipeline put on its `101` — the
 * `Set-Cookie` a hook issued, a chosen `Sec-WebSocket-Protocol` — go out with
 * it, minus the three the handshake owns.
 */
export function acceptWebSocket(options: {
	req: IncomingMessage;
	socket: UpgradeSocket;
	/** Bytes the server already read past the request head, from Node's `upgrade` event. */
	head: Buffer;
	/** Extra headers to send with the `101`. */
	headers?: Headers;
	events: WebSocketEvents;
	settings?: WebSocketSettings;
}): WebSocketConnection {
	const { req, socket, head, headers, events, settings } = options;
	const key = header(req, "sec-websocket-key") ?? "";
	const lines = [
		"HTTP/1.1 101 Switching Protocols",
		"Upgrade: websocket",
		"Connection: Upgrade",
		`Sec-WebSocket-Accept: ${acceptKey(key)}`,
	];
	headers?.forEach((value, name) => {
		if (HANDSHAKE_HEADERS.has(name.toLowerCase())) return;
		// `Set-Cookie` is the one header that legitimately repeats, and `Headers`
		// hands each of them to this callback separately
		lines.push(`${name}: ${value}`);
	});
	socket.write(`${lines.join("\r\n")}\r\n\r\n`);
	return createWebSocketConnection(socket, head, events, settings);
}

/** Headers the handshake writes itself, so a pipeline response cannot duplicate them. */
const HANDSHAKE_HEADERS = new Set([
	"upgrade",
	"connection",
	"sec-websocket-accept",
	"content-length",
	"content-type",
	"transfer-encoding",
]);

const STATUS_TEXT: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	426: "Upgrade Required",
	429: "Too Many Requests",
	500: "Internal Server Error",
};

/**
 * Answers a refused upgrade over the raw socket and closes it.
 *
 * By the time an `upgrade` listener runs there is no `ServerResponse` to write
 * through, so the refusal is written by hand. A browser reports it as a failed
 * handshake and `WebSocket` fires `error`; a client that reads the status —
 * kit's own, `curl`, a service — sees the app's own `401` or `404`.
 */
export async function refuseUpgrade(socket: UpgradeSocket, response: Response): Promise<void> {
	if (socket.destroyed) return;
	const body = Buffer.from(await response.arrayBuffer());
	const status = response.status;
	const lines = [
		`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}`,
		`Content-Length: ${body.byteLength}`,
		"Connection: close",
	];
	response.headers.forEach((value, name) => {
		if (name.toLowerCase() === "content-length" || name.toLowerCase() === "connection") return;
		lines.push(`${name}: ${value}`);
	});
	socket.write(`${lines.join("\r\n")}\r\n\r\n`);
	socket.end(body);
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

export type WebSocketFrame = { fin: boolean; opcode: number; payload: Buffer };

/** A control frame's payload may not exceed this, and it may not be fragmented. */
const MAX_CONTROL_PAYLOAD = 125;

/**
 * A frame as the server writes one: never masked, since masking is the
 * client's obligation and a masked server frame is a protocol error.
 */
export function encodeFrame(opcode: number, payload: Uint8Array, fin = true): Buffer {
	const length = payload.byteLength;
	const extended = length < 126 ? 0 : length < 65_536 ? 2 : 8;
	const frame = Buffer.allocUnsafe(2 + extended + length);
	frame[0] = (fin ? 0x80 : 0) | opcode;
	if (extended === 0) {
		frame[1] = length;
	} else if (extended === 2) {
		frame[1] = 126;
		frame.writeUInt16BE(length, 2);
	} else {
		frame[1] = 127;
		frame.writeBigUInt64BE(BigInt(length), 2);
	}
	// `set` rather than `copy`, so a caller's plain `Uint8Array` needs no trip
	// through a `Buffer` view of the same bytes on the way to the wire
	frame.set(payload, 2 + extended);
	return frame;
}

/** The two-byte code and the reason a close frame carries, if it carries any. */
export function decodeCloseFrame(payload: Buffer): { code: number; reason: string } {
	// a close frame with no payload is a close with no code, which is not the
	// same as `1006` — that one is reserved for a socket that never said anything
	if (payload.byteLength === 0) return { code: CLOSE_CODE.NORMAL, reason: "" };
	if (payload.byteLength === 1) {
		throw new WebSocketProtocolError("close frame payload must be 0 or at least 2 bytes");
	}
	return { code: payload.readUInt16BE(0), reason: payload.subarray(2).toString("utf8") };
}

/** A close frame's payload: the code, then the reason, capped to what a control frame holds. */
export function encodeClosePayload(code: number, reason: string): Buffer {
	const text = Buffer.from(reason, "utf8").subarray(0, MAX_CONTROL_PAYLOAD - 2);
	const payload = Buffer.allocUnsafe(2 + text.byteLength);
	payload.writeUInt16BE(code, 0);
	text.copy(payload, 2);
	return payload;
}

/**
 * Pulls whole frames out of a byte stream.
 *
 * `push` returns every frame the bytes so far complete and keeps the
 * remainder, so a frame split across TCP segments — or several frames arriving
 * in one — comes out the same either way.
 */
export function createFrameReader(options: { maxPayload: number }): {
	push(chunk: Buffer): WebSocketFrame[];
} {
	// annotated rather than inferred: a chunk off a socket is a `Buffer` over
	// whatever Node allocated, and the narrower type `Buffer.alloc` infers would
	// refuse to hold one
	let buffer: Buffer = Buffer.alloc(0);

	const readOne = (): WebSocketFrame | null => {
		if (buffer.byteLength < 2) return null;
		const first = buffer[0]!;
		const second = buffer[1]!;
		// kit negotiates no extensions, so a reserved bit set is a peer talking a
		// protocol nobody agreed to
		if ((first & 0x70) !== 0) throw new WebSocketProtocolError("reserved bits must be clear");
		const fin = (first & 0x80) !== 0;
		const opcode = first & 0x0f;
		const masked = (second & 0x80) !== 0;
		if (!masked) throw new WebSocketProtocolError("client frames must be masked");

		let length = second & 0x7f;
		let offset = 2;
		const control = (opcode & 0x08) !== 0;
		if (control) {
			if (length > MAX_CONTROL_PAYLOAD) {
				throw new WebSocketProtocolError("control frame payload must be 125 bytes or fewer");
			}
			if (!fin) throw new WebSocketProtocolError("control frames must not be fragmented");
		}
		if (length === 126) {
			if (buffer.byteLength < offset + 2) return null;
			length = buffer.readUInt16BE(offset);
			offset += 2;
		} else if (length === 127) {
			if (buffer.byteLength < offset + 8) return null;
			const big = buffer.readBigUInt64BE(offset);
			if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
				throw new WebSocketProtocolError("frame is too large", CLOSE_CODE.TOO_LARGE);
			}
			length = Number(big);
			offset += 8;
		}
		if (length > options.maxPayload) {
			throw new WebSocketProtocolError(
				`frame of ${length} bytes exceeds the ${options.maxPayload}-byte limit`,
				CLOSE_CODE.TOO_LARGE,
			);
		}
		const total = offset + 4 + length;
		if (buffer.byteLength < total) return null;

		const mask = buffer.subarray(offset, offset + 4);
		const payload = Buffer.allocUnsafe(length);
		buffer.copy(payload, 0, offset + 4, total);
		for (let index = 0; index < length; index += 1) {
			payload[index] = payload[index]! ^ mask[index % 4]!;
		}
		buffer = buffer.subarray(total);
		return { fin, opcode, payload };
	};

	return {
		push(chunk) {
			buffer = buffer.byteLength === 0 ? chunk : Buffer.concat([buffer, chunk]);
			const frames: WebSocketFrame[] = [];
			for (;;) {
				const frame = readOne();
				if (frame === null) return frames;
				frames.push(frame);
			}
		},
	};
}

// ---------------------------------------------------------------------------
// The connection
// ---------------------------------------------------------------------------

export type WebSocketEvents = {
	message(data: string | Uint8Array): void;
	close(details: { code: number; reason: string; clean: boolean }): void;
	error(error: unknown): void;
	/** The socket's write buffer emptied — what backpressure waits on. */
	drain(): void;
};

export type WebSocketSettings = {
	/**
	 * The largest single message the server will assemble, in bytes. A peer
	 * sending more is closed with `1009`. @default 16_777_216
	 */
	maxPayload?: number;
	/**
	 * Milliseconds between pings, or `false` for none. A peer that has not
	 * answered the last one by the time the next is due is dropped, so a dead
	 * connection is noticed within two intervals: a TCP socket whose peer
	 * vanished stays open indefinitely otherwise, holding whatever
	 * per-connection state the app built for it. @default 30_000
	 */
	heartbeat?: number | false;
	/**
	 * How long to wait for the peer's close frame after sending one, in
	 * milliseconds, before destroying the socket. @default 5_000
	 */
	closeTimeout?: number;
};

export type WebSocketConnection = SocketConnection & {
	/**
	 * Starts reading frames. Nothing arrives before this is called — a Node
	 * stream with no `data` listener does not flow — which is what lets the
	 * caller bind a session to the connection before the first message can
	 * reach a handler that is not there yet.
	 */
	start(): void;
	/** Drops the socket without a close handshake. */
	terminate(): void;
};

const DEFAULT_MAX_PAYLOAD = 16 * 1024 * 1024;

/**
 * Drives one upgraded socket: frames in become messages, `send` writes frames
 * out, and the close handshake is held open briefly so both sides agree the
 * conversation ended.
 */
export function createWebSocketConnection(
	socket: UpgradeSocket,
	head: Buffer,
	events: WebSocketEvents,
	settings: WebSocketSettings = {},
): WebSocketConnection {
	const maxPayload = settings.maxPayload ?? DEFAULT_MAX_PAYLOAD;
	const heartbeat = settings.heartbeat ?? 30_000;
	const closeTimeout = settings.closeTimeout ?? 5_000;
	const reader = createFrameReader({ maxPayload });

	let readyState: number = SocketReadyState.OPEN;
	/** Set once `close` has been reported, so the socket's own events cannot repeat it. */
	let reported = false;
	/** The opcode and bytes of a message still arriving in fragments. */
	let fragmentOpcode: number | null = null;
	let fragments: Buffer[] = [];
	let fragmentLength = 0;
	/** Whether the peer answered the last ping. */
	let alive = true;
	let pingTimer: ReturnType<typeof setInterval> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	/** What the peer said, or what kit sent — whichever ended the conversation. */
	let closeDetails: { code: number; reason: string; clean: boolean } | null = null;

	socket.setNoDelay?.(true);
	// a socket with no timeout of its own; the heartbeat below is what notices a
	// peer that stopped answering, and an idle connection is the normal case here
	socket.setTimeout?.(0);

	const finish = (details: { code: number; reason: string; clean: boolean }): void => {
		if (reported) return;
		reported = true;
		readyState = SocketReadyState.CLOSED;
		if (pingTimer !== undefined) clearInterval(pingTimer);
		if (closeTimer !== undefined) clearTimeout(closeTimer);
		events.close(details);
	};

	const destroy = (): void => {
		if (!socket.destroyed) socket.destroy();
		finish(closeDetails ?? { code: CLOSE_CODE.ABNORMAL, reason: "", clean: false });
	};

	const write = (frame: Buffer): void => {
		if (socket.destroyed || !socket.writable) return;
		socket.write(frame);
	};

	/** Sends a close frame and gives the peer a moment to send one back. */
	const startClose = (code: number, reason: string): void => {
		if (readyState !== SocketReadyState.OPEN) return;
		readyState = SocketReadyState.CLOSING;
		closeDetails ??= { code, reason, clean: true };
		write(encodeFrame(OPCODE.CLOSE, encodeClosePayload(code, reason)));
		closeTimer = setTimeout(destroy, closeTimeout);
		closeTimer.unref?.();
	};

	const handle = (frame: WebSocketFrame): void => {
		if (frame.opcode === OPCODE.PING) {
			write(encodeFrame(OPCODE.PONG, frame.payload));
			return;
		}
		if (frame.opcode === OPCODE.PONG) {
			alive = true;
			return;
		}
		if (frame.opcode === OPCODE.CLOSE) {
			const { code, reason } = decodeCloseFrame(frame.payload);
			closeDetails = { code, reason, clean: true };
			if (readyState === SocketReadyState.OPEN) {
				// the peer closed first: echo its code back, then the socket is done
				readyState = SocketReadyState.CLOSING;
				write(encodeFrame(OPCODE.CLOSE, encodeClosePayload(code, reason)));
			}
			socket.end();
			finish(closeDetails);
			return;
		}

		if (frame.opcode === OPCODE.CONTINUATION) {
			if (fragmentOpcode === null) {
				throw new WebSocketProtocolError("continuation frame with nothing to continue");
			}
		} else if (frame.opcode === OPCODE.TEXT || frame.opcode === OPCODE.BINARY) {
			if (fragmentOpcode !== null) {
				throw new WebSocketProtocolError("a new message started before the last one finished");
			}
			if (frame.fin) {
				deliver(frame.opcode, frame.payload);
				return;
			}
			fragmentOpcode = frame.opcode;
		} else {
			throw new WebSocketProtocolError(`unknown opcode 0x${frame.opcode.toString(16)}`);
		}

		fragmentLength += frame.payload.byteLength;
		if (fragmentLength > maxPayload) {
			throw new WebSocketProtocolError(
				`message exceeds the ${maxPayload}-byte limit`,
				CLOSE_CODE.TOO_LARGE,
			);
		}
		fragments.push(frame.payload);
		if (!frame.fin) return;
		const opcode = fragmentOpcode;
		const payload = Buffer.concat(fragments, fragmentLength);
		fragmentOpcode = null;
		fragments = [];
		fragmentLength = 0;
		deliver(opcode, payload);
	};

	const deliver = (opcode: number, payload: Buffer): void => {
		// text is a string and binary is bytes, which is the distinction the frame
		// exists to carry — a relay that only forwards bytes should never see one
		// silently become a string
		events.message(
			opcode === OPCODE.TEXT
				? payload.toString("utf8")
				: new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength),
		);
	};

	const consume = (chunk: Buffer): void => {
		let frames: WebSocketFrame[];
		try {
			frames = reader.push(chunk);
		} catch (error) {
			fail(error);
			return;
		}
		for (const frame of frames) {
			try {
				handle(frame);
			} catch (error) {
				fail(error);
				return;
			}
		}
	};

	/** A frame kit could not accept: close with the code it named, and say so. */
	const fail = (error: unknown): void => {
		const code = error instanceof WebSocketProtocolError ? error.code : CLOSE_CODE.INTERNAL;
		events.error(error);
		startClose(code, error instanceof Error ? error.message.slice(0, 120) : "");
		// nothing after a protocol error is worth reading, and the peer may not
		// answer the close frame at all
		socket.end();
		finish({ code, reason: "", clean: false });
	};

	socket.on("drain", () => {
		events.drain();
	});
	socket.on("error", (error) => {
		if (!reported) events.error(error);
		destroy();
	});
	socket.on("close", destroy);
	socket.on("end", () => {
		// the peer half-closed without a close frame; nothing more will arrive
		socket.end();
		destroy();
	});

	if (heartbeat !== false && heartbeat > 0) {
		pingTimer = setInterval(() => {
			if (readyState !== SocketReadyState.OPEN) return;
			if (!alive) {
				// the last ping went unanswered for a whole interval: the peer is
				// gone, whatever TCP still thinks
				destroy();
				return;
			}
			alive = false;
			write(encodeFrame(OPCODE.PING, Buffer.alloc(0)));
		}, heartbeat);
		// a heartbeat is not a reason for the process to stay up
		pingTimer.unref?.();
	}

	return {
		start() {
			socket.on("data", consume);
			// bytes Node read past the request head belong to the first frames
			if (head.byteLength > 0) consume(head);
		},
		get readyState() {
			return readyState;
		},
		get bufferedAmount() {
			return socket.writableLength;
		},
		send(data) {
			if (readyState !== SocketReadyState.OPEN) return;
			const payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
			write(encodeFrame(typeof data === "string" ? OPCODE.TEXT : OPCODE.BINARY, payload));
		},
		close(code = CLOSE_CODE.NORMAL, reason = "") {
			startClose(code, reason);
		},
		terminate: destroy,
	};
}
