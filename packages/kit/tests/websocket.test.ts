/* oxlint-disable typescript/no-unsafe-type-assertion -- Driving a real socket back through the app's types requires intentional narrowing. */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import type { EndpointRoute } from "../src/match.ts";
import { serveSockets } from "../src/node.ts";
import { createKitServer, error, socket, type KitServer } from "../src/server.ts";
import type { SocketCloseDetails, SocketHandlers, SocketPeer } from "../src/socket.ts";
import {
	acceptKey,
	CLOSE_CODE,
	createFrameReader,
	decodeCloseFrame,
	encodeClosePayload,
	encodeFrame,
	handshakeProblem,
	OPCODE,
} from "../src/websocket.ts";

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/** A frame as a client writes one: masked, since the protocol requires it. */
function clientFrame(opcode: number, payload: Buffer | string, fin = true): Buffer {
	const body = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
	const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
	const length = body.byteLength;
	const extended = length < 126 ? 0 : length < 65_536 ? 2 : 8;
	const frame = Buffer.alloc(2 + extended + 4 + length);
	frame[0] = (fin ? 0x80 : 0) | opcode;
	frame[1] = 0x80 | (extended === 0 ? length : extended === 2 ? 126 : 127);
	if (extended === 2) frame.writeUInt16BE(length, 2);
	if (extended === 8) frame.writeBigUInt64BE(BigInt(length), 2);
	mask.copy(frame, 2 + extended);
	for (let index = 0; index < length; index += 1) {
		frame[2 + extended + 4 + index] = body[index]! ^ mask[index % 4]!;
	}
	return frame;
}

describe("acceptKey", () => {
	it("answers the example from the RFC", () => {
		expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
	});
});

/** Just enough of an `IncomingMessage` for the handshake check to read. */
const req = (headers: Record<string, string>, method = "GET") => ({ method, headers }) as never;

describe("handshakeProblem", () => {
	it("passes a well-formed handshake", () => {
		expect(
			handshakeProblem(
				req({ "sec-websocket-version": "13", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" }),
			),
		).toBeNull();
	});

	it("names the version it speaks, and refuses a missing or malformed key", () => {
		expect(handshakeProblem(req({ "sec-websocket-version": "8" }))).toContain("13");
		expect(handshakeProblem(req({ "sec-websocket-version": "13" }))).toContain("Sec-WebSocket-Key");
		expect(
			handshakeProblem(req({ "sec-websocket-version": "13", "sec-websocket-key": "short" })),
		).toContain("Sec-WebSocket-Key");
	});
});

describe("encodeFrame", () => {
	it("uses the shortest length form each payload fits in", () => {
		expect(encodeFrame(OPCODE.TEXT, Buffer.alloc(5))[1]).toBe(5);
		const medium = encodeFrame(OPCODE.BINARY, Buffer.alloc(200));
		expect(medium[1]).toBe(126);
		expect(medium.readUInt16BE(2)).toBe(200);
		const large = encodeFrame(OPCODE.BINARY, Buffer.alloc(70_000));
		expect(large[1]).toBe(127);
		expect(large.readBigUInt64BE(2)).toBe(70_000n);
	});

	it("never masks, since masking is the client's obligation", () => {
		expect((encodeFrame(OPCODE.TEXT, Buffer.from("hi"))[1]! & 0x80) === 0).toBe(true);
	});

	it("writes FIN unless told otherwise", () => {
		expect(encodeFrame(OPCODE.TEXT, Buffer.alloc(0))[0]! & 0x80).toBe(0x80);
		expect(encodeFrame(OPCODE.TEXT, Buffer.alloc(0), false)[0]! & 0x80).toBe(0);
	});
});

describe("close frames", () => {
	it("round-trips a code and a reason", () => {
		expect(decodeCloseFrame(encodeClosePayload(1011, "boom"))).toEqual({
			code: 1011,
			reason: "boom",
		});
	});

	it("reads an empty payload as a normal close rather than as an abnormal one", () => {
		expect(decodeCloseFrame(Buffer.alloc(0))).toEqual({ code: CLOSE_CODE.NORMAL, reason: "" });
	});

	it("refuses a one-byte payload, which is neither a code nor nothing", () => {
		expect(() => decodeCloseFrame(Buffer.alloc(1))).toThrow(/0 or at least 2/);
	});

	it("caps the reason at what a control frame holds", () => {
		expect(encodeClosePayload(1000, "x".repeat(300)).byteLength).toBe(125);
	});
});

/** A reader with a small cap, so the oversize case is cheap to reach. */
const reader = () => createFrameReader({ maxPayload: 1024 });

describe("createFrameReader", () => {
	it("unmasks a client frame", () => {
		const [frame] = reader().push(clientFrame(OPCODE.TEXT, "hello"));
		expect(frame?.payload.toString("utf8")).toBe("hello");
		expect(frame?.opcode).toBe(OPCODE.TEXT);
		expect(frame?.fin).toBe(true);
	});

	it("reassembles a frame split across chunks", () => {
		const read = reader();
		const frame = clientFrame(OPCODE.TEXT, "split me");
		expect(read.push(frame.subarray(0, 4))).toHaveLength(0);
		expect(read.push(frame.subarray(4, 7))).toHaveLength(0);
		const frames = read.push(frame.subarray(7));
		expect(frames[0]?.payload.toString("utf8")).toBe("split me");
	});

	it("returns every frame a single chunk completes", () => {
		const frames = reader().push(
			Buffer.concat([clientFrame(OPCODE.TEXT, "a"), clientFrame(OPCODE.TEXT, "b")]),
		);
		expect(frames.map((frame) => frame.payload.toString("utf8"))).toEqual(["a", "b"]);
	});

	it("reads the two extended length forms", () => {
		const medium = reader().push(clientFrame(OPCODE.BINARY, Buffer.alloc(200, 7)));
		expect(medium[0]?.payload.byteLength).toBe(200);
		expect(medium[0]?.payload[199]).toBe(7);
	});

	it("refuses an unmasked client frame", () => {
		expect(() => reader().push(encodeFrame(OPCODE.TEXT, Buffer.from("hi")))).toThrow(
			/must be masked/,
		);
	});

	it("refuses a reserved bit, which would mean an extension nobody negotiated", () => {
		const frame = clientFrame(OPCODE.TEXT, "hi");
		frame[0] = frame[0]! | 0x40;
		expect(() => reader().push(frame)).toThrow(/reserved bits/);
	});

	it("refuses a control frame that is fragmented or oversized", () => {
		expect(() => reader().push(clientFrame(OPCODE.PING, "x", false))).toThrow(/fragmented/);
		expect(() => reader().push(clientFrame(OPCODE.PING, Buffer.alloc(200)))).toThrow(/125 bytes/);
	});

	it("refuses a payload over the limit rather than buffering it", () => {
		expect(() => reader().push(clientFrame(OPCODE.BINARY, Buffer.alloc(2_000)))).toThrow(
			/exceeds the 1024-byte limit/,
		);
	});
});

// ---------------------------------------------------------------------------
// End to end, over a real socket
// ---------------------------------------------------------------------------

const endpoint = (pattern: string, module: Record<string, unknown>): EndpointRoute => ({
	pattern,
	id: pattern,
	extension: null,
	file: "ws/server.ts",
	module,
});

function app(handlers: SocketHandlers): KitServer {
	return createKitServer({
		hooks: {},
		pages: [],
		endpoints: [
			endpoint("/ws", { SOCKET: socket(handlers) }),
			endpoint("/plain", { GET: () => new Response("ok") }),
		],
		renderPage: () => null,
	});
}

/** A running server with the app's socket routes attached, and the URL to reach it at. */
async function listen(kit: KitServer): Promise<{ url: string; server: Server; stop(): void }> {
	const sockets = serveSockets(kit.upgrade);
	const server = createServer((_req, res) => {
		res.statusCode = 404;
		res.end("not found");
	});
	server.on("upgrade", (req, socket, head) => {
		sockets(req, socket, head).then(
			(handled) => {
				if (!handled) socket.destroy();
			},
			() => socket.destroy(),
		);
	});
	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", resolve);
	});
	const { port } = server.address() as AddressInfo;
	return {
		url: `ws://127.0.0.1:${port}`,
		server,
		stop: () => {
			server.closeAllConnections();
			server.close();
		},
	};
}

/** Resolves once the socket opens, or rejects with what went wrong instead. */
function opened(ws: WebSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		ws.addEventListener("open", () => resolve(), { once: true });
		ws.addEventListener("error", () => reject(new Error("handshake failed")), { once: true });
	});
}

const nextMessage = (ws: WebSocket): Promise<MessageEvent> =>
	new Promise((resolve) => {
		ws.addEventListener("message", (event) => resolve(event), { once: true });
	});

const nextClose = (ws: WebSocket): Promise<CloseEvent> =>
	new Promise((resolve) => {
		ws.addEventListener("close", (event) => resolve(event), { once: true });
	});

describe("a socket route, end to end", () => {
	it("opens, echoes text, and echoes bytes", async () => {
		const host = await listen(
			app({
				open: (peer) => peer.send("welcome"),
				message: (peer, message) =>
					peer.send(message.binary ? message.uint8Array() : message.text().toUpperCase()),
			}),
		);
		try {
			const ws = new WebSocket(`${host.url}/ws`);
			ws.binaryType = "arraybuffer";
			await opened(ws);
			expect((await nextMessage(ws)).data).toBe("welcome");

			ws.send("hello");
			expect((await nextMessage(ws)).data).toBe("HELLO");

			ws.send(new Uint8Array([1, 2, 3]));
			const bytes = await nextMessage(ws);
			expect([...new Uint8Array(bytes.data as ArrayBuffer)]).toEqual([1, 2, 3]);

			ws.close(1000, "done");
			await nextClose(ws);
		} finally {
			host.stop();
		}
	});

	it("carries a message bigger than the two short length forms", async () => {
		const host = await listen(app({ message: (peer, message) => peer.send(message.text()) }));
		try {
			const ws = new WebSocket(`${host.url}/ws`);
			await opened(ws);
			const payload = "x".repeat(200_000);
			ws.send(payload);
			expect((await nextMessage(ws)).data).toBe(payload);
			ws.close();
			await nextClose(ws);
		} finally {
			host.stop();
		}
	});

	it("tells the route when the client hangs up, with the code it sent", async () => {
		let resolve!: (details: SocketCloseDetails) => void;
		const reported = new Promise<SocketCloseDetails>((settle) => {
			resolve = settle;
		});
		let peer: SocketPeer | undefined;
		const host = await listen(
			app({
				close: (connected, details) => {
					peer = connected;
					resolve(details);
				},
			}),
		);
		try {
			const ws = new WebSocket(`${host.url}/ws`);
			await opened(ws);
			ws.close(4001, "bye");
			expect(await reported).toEqual({ code: 4001, reason: "bye", clean: true });
			// the signal aborts *after* the route's own close runs, so a handler
			// still sees the peer it is releasing state for
			expect(peer?.signal.aborted).toBe(false);
		} finally {
			host.stop();
		}
	});

	it("closes from the server with the code the route chose", async () => {
		const host = await listen(app({ open: (peer) => peer.close(4002, "go away") }));
		try {
			const ws = new WebSocket(`${host.url}/ws`);
			await opened(ws);
			const event = await nextClose(ws);
			expect(event.code).toBe(4002);
			expect(event.reason).toBe("go away");
		} finally {
			host.stop();
		}
	});

	it("refuses an upgrade the route turned down, and never opens", async () => {
		const host = await listen(app({ upgrade: () => error(401, "sign in first") }));
		try {
			const ws = new WebSocket(`${host.url}/ws`);
			await expect(opened(ws)).rejects.toThrow(/handshake failed/);
		} finally {
			host.stop();
		}
	});

	it("leaves a path with no socket route to whatever else is listening", async () => {
		const host = await listen(app({}));
		try {
			const ws = new WebSocket(`${host.url}/plain`);
			await expect(opened(ws)).rejects.toThrow(/handshake failed/);
		} finally {
			host.stop();
		}
	});
});
