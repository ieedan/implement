/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading a stream back as the events it carries requires intentional narrowing. */
import { describe, expect, it } from "vitest";
import { createClient, type Operations, type TypedClient } from "../src/client.ts";
import { handler } from "../src/endpoint.ts";
import type { EndpointRoute } from "../src/match.ts";
import { createKitServer } from "../src/server.ts";
import {
	decodeEvent,
	decodeEventStream,
	encodeEvent,
	type ServerSentEvent,
	sse,
} from "../src/sse.ts";

/** The frames of a response, as text — the wire, not the parse of it. */
async function frames(response: Response): Promise<string> {
	return await response.text();
}

/** Every event a stream carries, to its end. */
async function collect<T>(
	events: AsyncIterable<ServerSentEvent<T>>,
): Promise<ServerSentEvent<T>[]> {
	const seen: ServerSentEvent<T>[] = [];
	for await (const event of events) seen.push(event);
	return seen;
}

/** A source that never ends, so a test can prove the reader is not waiting for one. */
function forever<T>(values: T[]): {
	source: () => AsyncGenerator<ServerSentEvent<T>>;
	ended: () => boolean;
} {
	let closed = false;
	async function* source(): AsyncGenerator<ServerSentEvent<T>> {
		try {
			for (const data of values) yield { data };
			// nothing more to send, and nothing saying the stream is over
			await new Promise(() => undefined);
		} finally {
			closed = true;
		}
	}
	return { source, ended: () => closed };
}

describe("encodeEvent", () => {
	it("writes the payload as JSON on one data line", () => {
		expect(encodeEvent({ data: { id: 1, title: "hi" } })).toBe('data: {"id":1,"title":"hi"}\n\n');
	});

	it("writes the fields the format defines, in order, before the data", () => {
		expect(encodeEvent({ event: "tick", id: "7", retry: 2000, data: 1 })).toBe(
			"event: tick\nid: 7\nretry: 2000\ndata: 1\n\n",
		);
	});

	it("keeps a line break out of a field, so an id cannot forge a frame", () => {
		const frame = encodeEvent({ id: "7\n\ndata: {}", data: null });
		expect(frame).toBe("id: 7  data: {}\ndata: null\n\n");
		expect(decodeEvent(frame)).toEqual({
			data: null,
			event: undefined,
			id: "7  data: {}",
			retry: undefined,
		});
	});

	it("keeps a payload's own newlines inside the JSON string", () => {
		const frame = encodeEvent({ data: "a\nb" });
		expect(frame.split("\n")).toHaveLength(3);
		expect(decodeEvent<string>(frame)?.data).toBe("a\nb");
	});
});

describe("decodeEvent", () => {
	it("reads the fields back", () => {
		expect(decodeEvent("event: tick\nid: 7\nretry: 2000\ndata: 1")).toEqual({
			data: 1,
			event: "tick",
			id: "7",
			retry: 2000,
		});
	});

	it("drops exactly one leading space after the colon, and no more", () => {
		expect(decodeEvent<string>("data:  hello")?.data).toBe(" hello");
		expect(decodeEvent<string>("data:hello")?.data).toBe("hello");
	});

	it("joins repeated data lines with a newline", () => {
		expect(decodeEvent<string>("data: a\ndata: b")?.data).toBe("a\nb");
	});

	it("ignores comments, and a frame carrying only one is not an event", () => {
		expect(decodeEvent(": keep-alive")).toBeNull();
		expect(decodeEvent(": keep-alive\ndata: 1")).toEqual({
			data: 1,
			event: undefined,
			id: undefined,
			retry: undefined,
		});
	});

	it("hands back text a sender did not encode as JSON", () => {
		expect(decodeEvent<string>("data: hello")?.data).toBe("hello");
	});

	it("ignores a retry that is not a whole number of milliseconds", () => {
		expect(decodeEvent("retry: soon\ndata: 1")?.retry).toBeUndefined();
	});
});

describe("decodeEventStream", () => {
	it("reads frames split across chunks, however they are broken", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				const encoder = new TextEncoder();
				controller.enqueue(encoder.encode("data: 1\r\n\r\ndata:"));
				controller.enqueue(encoder.encode(" 2\n\ndata: 3\r"));
				controller.enqueue(encoder.encode("\r"));
				controller.close();
			},
		});
		expect((await collect<number>(decodeEventStream(stream))).map((event) => event.data)).toEqual([
			1, 2, 3,
		]);
	});

	it("cancels the body when the consumer stops reading", async () => {
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("data: 1\n\ndata: 2\n\n"));
			},
			cancel() {
				cancelled = true;
			},
		});
		for await (const event of decodeEventStream<number>(stream)) {
			expect(event.data).toBe(1);
			break;
		}
		expect(cancelled).toBe(true);
	});
});

/** One event and done — the same source reached as an iterable and as a function. */
async function* one(): AsyncGenerator<ServerSentEvent<number>> {
	yield { data: 1 };
}

describe("sse", () => {
	it("answers with the headers the format needs", () => {
		const response = sse(async function* () {
			yield { data: 1 };
		});
		expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
		expect(response.headers.get("cache-control")).toBe("private, no-cache, no-transform");
		expect(response.headers.get("x-accel-buffering")).toBe("no");
	});

	it("takes an iterable as readily as a function producing one", async () => {
		expect(await frames(sse(one()))).toBe("data: 1\n\n");
		expect(await frames(sse(one))).toBe("data: 1\n\n");
	});

	it("keeps the caller's own headers and status, and wins where they collide", async () => {
		const response = sse(
			async function* () {
				yield { data: 1 };
			},
			{ status: 201, headers: { "x-app": "docs", "content-type": "text/plain" } },
		);
		expect(response.status).toBe(201);
		expect(response.headers.get("x-app")).toBe("docs");
		expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
	});

	it("ends the stream when the source does", async () => {
		const response = sse(async function* () {
			yield { event: "tick", data: 1 };
			yield { event: "tick", data: 2 };
		});
		expect(await frames(response)).toBe("event: tick\ndata: 1\n\nevent: tick\ndata: 2\n\n");
	});

	it("returns the source when the client goes away, so a `finally` runs", async () => {
		const { source, ended } = forever([1, 2]);
		const response = sse(source, { keepAlive: false });
		const reader = response.body!.getReader();
		await reader.read();
		await reader.cancel();
		// the cancel returns the iterator, which resumes the generator at its yield
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(ended()).toBe(true);
	});

	it("ends the stream when the signal aborts", async () => {
		const { source, ended } = forever([1]);
		const controller = new AbortController();
		const response = sse(source, { keepAlive: false, signal: controller.signal });
		const reader = response.body!.getReader();
		expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: 1\n\n");
		controller.abort();
		expect((await reader.read()).done).toBe(true);
		expect(ended()).toBe(true);
	});

	it("sends a comment while the source has nothing to say", async () => {
		const { source } = forever<number>([]);
		const response = sse(source, { keepAlive: 5 });
		// the keep-alive clock is unref'd, so this is what stands in for the
		// socket a real server would be holding open while the stream runs
		const held = setInterval(() => undefined, 1000);
		try {
			const reader = response.body!.getReader();
			expect(new TextDecoder().decode((await reader.read()).value)).toBe(": keep-alive\n\n");
			await reader.cancel();
		} finally {
			clearInterval(held);
		}
	});

	it("hands the source a signal that aborts when the stream ends", async () => {
		let aborted = false;
		const response = sse(
			async function* (signal: AbortSignal) {
				signal.addEventListener("abort", () => {
					aborted = true;
				});
				yield { data: 1 };
				// parked on something the signal is the only way out of, which is
				// what a source waiting on a queue or a subscription looks like
				await new Promise(() => undefined);
			},
			{ keepAlive: false },
		);
		const reader = response.body!.getReader();
		await reader.read();
		await reader.cancel();
		expect(aborted).toBe(true);
	});

	it("does not wait on a source that a return can never reach", async () => {
		const response = sse(
			async function* () {
				yield { data: 1 };
				// a generator suspended inside an `await` takes a return request
				// only when it next reaches a `yield` — so this one never does
				await new Promise(() => undefined);
			},
			{ keepAlive: false },
		);
		const reader = response.body!.getReader();
		await reader.read();
		// the assertion is that this settles at all
		await reader.cancel();
	});

	it("errors the stream when the source throws mid-flight", async () => {
		const response = sse(async function* () {
			yield { data: 1 };
			throw new Error("upstream went away");
		});
		await expect(frames(response)).rejects.toThrow("upstream went away");
	});
});

// ---------------------------------------------------------------------------
// Through the pipeline, and back out through the generated client
// ---------------------------------------------------------------------------

const stream = {
	GET: handler({
		handle: () =>
			sse<{ n: number }>(async function* () {
				yield { event: "tick", data: { n: 1 } };
				yield { event: "tick", data: { n: 2 } };
			}),
	}),
};

const STREAM_URL = "http://api.test/api/stream";

type Api = {
	"/api/stream": { params: Record<never, never>; operations: Operations<typeof stream> };
};

/**
 * What the client reads `data` as for this route — an event stream rather than
 * the `never` a plain `Response` leaves behind. `tsc` is the only one who can
 * check these, and `@ts-expect-error` fails the check if one stops being an
 * error.
 */
type StreamData = Operations<typeof stream>["GET"]["data"];
type Expect<T extends true> = T;
type Assignable<A, B> = A extends B ? true : false;

export type _TakesTheEvents = Expect<
	Assignable<AsyncGenerator<{ event: string; data: { n: number } }>, StreamData>
>;
// @ts-expect-error the frames carry `{ n: number }`, so a stream of strings is not one
export type _NotSomeOtherPayload = Expect<Assignable<AsyncGenerator<{ data: string }>, StreamData>>;

const route: EndpointRoute = {
	pattern: "/api/stream",
	id: "/api/stream",
	extension: null,
	file: "/api/stream/server.ts",
	module: stream,
};

describe("an event stream through kit", () => {
	it("reaches the response with its body still a stream", async () => {
		const kit = createKitServer({
			hooks: {
				// a hook that sets a header copies the response, which must not
				// buffer what it is copying
				handle: async ({ event, resolve }) => {
					event.setHeaders({ "x-served": "1" });
					return await resolve(event);
				},
			},
			pages: [],
			endpoints: [route],
			renderPage: () => null,
		});
		const response = await kit.respond(new Request("http://localhost/api/stream"));
		expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
		expect(response.headers.get("x-served")).toBe("1");
		expect(response.body).not.toBeNull();
		expect(await frames(response)).toBe(
			'event: tick\ndata: {"n":1}\n\nevent: tick\ndata: {"n":2}\n\n',
		);
	});

	it("comes back from the client as its events rather than as text", async () => {
		const api: TypedClient<Api> = createClient({
			baseUrl: "http://api.test",
			fetch: () =>
				stream.GET({
					request: new Request(STREAM_URL),
					url: new URL(STREAM_URL),
					params: {},
				} as never),
		});
		const { data, error } = await api.GET("/api/stream");
		expect(error).toBeUndefined();
		const seen = await collect(data!);
		expect(seen.map((event) => event.data)).toEqual([{ n: 1 }, { n: 2 }]);
		expect(seen[0]!.event).toBe("tick");
	});

	it("resolves before the stream has ended, and stops it on a break", async () => {
		const { source, ended } = forever([{ n: 1 }, { n: 2 }]);
		const api: TypedClient<Api> = createClient({
			baseUrl: "http://api.test",
			fetch: () => Promise.resolve(sse(source, { keepAlive: false })),
		});
		// the call would never settle if the client read the body to its end
		const { data } = await api.GET("/api/stream");
		for await (const event of data!) {
			expect(event.data).toEqual({ n: 1 });
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(ended()).toBe(true);
	});

	it("still reads an error as an error, since a failure is not a stream", async () => {
		const api: TypedClient<Api> = createClient({
			baseUrl: "http://api.test",
			fetch: () => Promise.resolve(Response.json({ message: "no" }, { status: 503 })),
		});
		const { data, error } = await api.GET("/api/stream");
		expect(data).toBeUndefined();
		expect(error?.status).toBe(503);
		expect(error?.message).toBe("no");
	});
});
