/**
 * Server-sent events, both halves of them: the {@link sse} response a
 * `server.ts` returns, and the parser the generated client reads one back
 * with.
 *
 * ```ts
 * // src/routes/api/inbox/stream/server.ts
 * import { handler, sse } from "./$types";
 *
 * export const GET = handler({
 * 	handle: ({ locals }) =>
 * 		sse<Notification>(async function* (signal) {
 * 			for await (const notification of watchInbox(locals.user.id, signal)) {
 * 				yield { event: "notification", data: notification };
 * 			}
 * 		}),
 * });
 * ```
 *
 * ```ts
 * const { data, error } = await api.GET("/api/inbox/stream");
 * if (error !== undefined) return;
 * for await (const { data: notification } of data) show(notification);
 * ```
 *
 * A response is a `ReadableStream` and nothing in kit's pipeline buffers one,
 * so the connection stays open for as long as the generator does — see
 * [adapters](https://implementjs.dev/kit/adapters) for how long each host lets
 * that be.
 *
 * Dependency-free and web-standard throughout, like `./endpoint.ts`: this
 * module is imported by the browser client as well as by the server.
 */

/**
 * One frame of an event stream. `data` is the payload — JSON on the wire, and
 * whatever the handler said it was at either end — and the rest are the fields
 * the format itself defines.
 */
export type ServerSentEvent<T> = {
	/** The payload. Serialized as JSON in the frame's `data:` field. */
	data: T;
	/** The frame's `event:` field — what an `EventSource` listener is named after. */
	event?: string;
	/** The frame's `id:` field, which a reconnecting browser sends back as `Last-Event-ID`. */
	id?: string;
	/** How long a disconnected client should wait before reconnecting, in milliseconds. */
	retry?: number;
};

/** The phantom key an {@link sse} response carries its event type on. */
declare const SSE_DATA: unique symbol;

/**
 * A `Response` that remembers what its frames carry. The key is a phantom —
 * nothing sets it at runtime — and it is required rather than optional so a
 * plain `Response` is not one of these by accident.
 */
export interface SseResponse<T> extends Response {
	readonly [SSE_DATA]: T;
}

/**
 * What {@link sse} streams: the events themselves, or a function producing
 * them. The function form is the one you want for an async generator, since
 * `sse(async function* () { … })` reads as a body rather than as a call — and
 * it is handed a signal that aborts the moment the stream is over, however it
 * ended.
 *
 * That signal is what a source waiting on something else should be waiting on
 * too. Returning a generator only interrupts it at a `yield`, so one parked on
 * a promise that never settles is never reached; one waiting under the signal
 * is.
 */
export type SseSource<T> =
	| AsyncIterable<ServerSentEvent<T>>
	| ((signal: AbortSignal) => AsyncIterable<ServerSentEvent<T>>);

export type SseInit = Omit<ResponseInit, "headers"> & {
	/** Merged under the ones the format requires, which win. */
	headers?: HeadersInit;
	/**
	 * Milliseconds between keep-alive comments, or `false` to send none. A
	 * proxy closes a connection that has been idle too long, and a comment is
	 * the format's own way of saying nothing.
	 *
	 * @default 15000
	 */
	keepAlive?: number | false;
	/** Ends the stream when it aborts — a shutdown, or a deadline of your own. */
	signal?: AbortSignal;
};

/** Headers the format requires. Set after the caller's, so these win. */
const SSE_HEADERS: Record<string, string> = {
	"content-type": "text/event-stream; charset=utf-8",
	// `no-transform` is the half that matters to a proxy that would otherwise
	// compress — and buffer — the whole stream before passing any of it on
	"cache-control": "private, no-cache, no-transform",
	// nginx reads this and stops buffering; every other host ignores it
	"x-accel-buffering": "no",
};

/**
 * An event stream as a `Response`, typed with what its frames carry.
 *
 * ```ts
 * export const GET = handler({
 * 	handle: () =>
 * 		sse<Tick>(async function* (signal) {
 * 			const subscription = await subscribe();
 * 			try {
 * 				for await (const tick of subscription.ticks(signal)) yield { data: tick };
 * 			} finally {
 * 				await subscription.close();
 * 			}
 * 		}),
 * });
 * ```
 *
 * The stream lives as long as the source does. When it ends — the client hung
 * up, `signal` aborted, the source ran out — the iterator is returned and the
 * signal the source was handed aborts, so a generator's `finally` runs and
 * whatever it was holding gets let go. Wait on that signal rather than on a
 * bare promise: a generator parked on one that never settles never reaches the
 * `yield` where a return would interrupt it.
 *
 * Returning this from a `handle` skips response handling like any other
 * `Response`, and a `response` schema is not validated against it. Unlike a
 * plain one it still says what a caller receives: the generated client reads
 * `data` as an `AsyncIterable` of these events rather than as `never`.
 */
export function sse<T>(source: SseSource<T>, init: SseInit = {}): SseResponse<T> {
	const { keepAlive = 15_000, signal, headers: given, ...rest } = init;
	const encoder = new TextEncoder();
	/** Aborts when the stream is over — what the source is given to wait under. */
	const stop = new AbortController();
	let iterator: AsyncIterator<ServerSentEvent<T>> | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	let done = false;

	/** Nothing more will be enqueued — stop the clock and let the source go. */
	const finish = (): void => {
		if (done) return;
		done = true;
		if (timer !== undefined) clearInterval(timer);
		stop.abort();
		// deliberately not awaited: a generator processes a return request only
		// when it next reaches a `yield`, so one parked on a promise would keep
		// the response open on a cleanup that may never come back
		void Promise.resolve(iterator?.return?.()).catch(() => undefined);
	};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const events = typeof source === "function" ? source(stop.signal) : source;
			iterator = events[Symbol.asyncIterator]();

			if (keepAlive !== false && keepAlive > 0) {
				timer = setInterval(() => {
					// a comment frame: every client discards it, and a proxy counting
					// idle seconds starts over. Only while there is demand for one —
					// a consumer with a chunk it has not read yet is not idle, and
					// queueing heartbeats behind it would say nothing to anyone
					if (done || (controller.desiredSize ?? 0) <= 0) return;
					enqueue(controller, encoder.encode(": keep-alive\n\n"));
				}, keepAlive);
				// a heartbeat is not a reason for the process to stay up
				unref(timer);
			}

			if (signal !== undefined) {
				if (signal.aborted) {
					close(controller, finish);
					return;
				}
				signal.addEventListener("abort", () => close(controller, finish), { once: true });
			}
		},
		async pull(controller) {
			// the source is spent or gone: close rather than return, since a `pull`
			// that fulfills without enqueueing is asked again straight away
			if (done) {
				closeQuietly(controller);
				return;
			}
			let next: IteratorResult<ServerSentEvent<T>>;
			try {
				next = await iterator!.next();
			} catch (error) {
				finish();
				controller.error(error);
				return;
			}
			if (done || next.done === true) {
				close(controller, finish);
				return;
			}
			enqueue(controller, encoder.encode(encodeEvent(next.value)));
		},
		cancel() {
			// the client hung up, or a consumer stopped reading — either way the
			// source is what is still running, and this is what stops it
			finish();
		},
	});

	const headers = new Headers(given);
	for (const [name, value] of Object.entries(SSE_HEADERS)) headers.set(name, value);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The phantom key is type-level only; the value is the `Response` it says it is.
	return new Response(stream, { ...rest, headers }) as SseResponse<T>;
}

/**
 * Lets the host stop waiting on the keep-alive clock. Node's timer has
 * `unref`; a browser's is a number, and there is nothing there to hold open.
 */
function unref(timer: unknown): void {
	if (typeof timer !== "object" || timer === null || !("unref" in timer)) return;
	const { unref: release } = timer;
	if (typeof release === "function") release.call(timer);
}

/** Enqueues unless the stream is already gone, which is not an error here. */
function enqueue(controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array): void {
	try {
		controller.enqueue(chunk);
	} catch {
		// closed or errored between the check and the call — nothing left to say
	}
}

function close(controller: ReadableStreamDefaultController<Uint8Array>, finish: () => void): void {
	finish();
	closeQuietly(controller);
}

function closeQuietly(controller: ReadableStreamDefaultController<Uint8Array>): void {
	try {
		controller.close();
	} catch {
		// already closed
	}
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** One event as the wire carries it, blank line and all. */
export function encodeEvent(event: ServerSentEvent<unknown>): string {
	let frame = "";
	if (event.event !== undefined) frame += `event: ${oneLine(event.event)}\n`;
	if (event.id !== undefined) frame += `id: ${oneLine(event.id)}\n`;
	if (event.retry !== undefined) frame += `retry: ${Math.trunc(event.retry)}\n`;
	// JSON escapes every line break it could contain, so the payload is always
	// exactly one `data:` line
	frame += `data: ${JSON.stringify(event.data) ?? "null"}\n\n`;
	return frame;
}

/**
 * A field value with its line breaks gone. A frame is delimited by them, so an
 * `id` read out of a database is otherwise a way to forge one.
 */
function oneLine(value: string): string {
	return value.replaceAll(/[\r\n]/g, " ");
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** `\r\n\r\n`, `\n\n`, or `\r\r` — the format allows all three as a break. */
const FRAME_BREAK = /\r\n\r\n|\n\n|\r\r/;
const LINE_BREAK = /\r\n|\n|\r/;

/**
 * The frames of an event stream, as they arrive.
 *
 * Ending the loop — a `break`, a `return`, a thrown error — cancels the body,
 * which is what closes the connection and lets the server's own `finally` run.
 */
export async function* decodeEventStream<T>(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent<T>, void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			for (;;) {
				const match = FRAME_BREAK.exec(buffer);
				if (match === null) break;
				const frame = buffer.slice(0, match.index);
				buffer = buffer.slice(match.index + match[0].length);
				const event = decodeEvent<T>(frame);
				if (event !== null) yield event;
			}
		}
	} finally {
		// the loop ended, however it ended — a `break` in the caller's `for await`
		// included, which is how a consumer says it is done
		await reader.cancel().catch(() => undefined);
	}
}

/**
 * One frame's fields, or `null` for a frame carrying no `data` — a comment
 * heartbeat, or a lone `retry:`, neither of which is an event.
 */
export function decodeEvent<T>(frame: string): ServerSentEvent<T> | null {
	let data: string | null = null;
	let event: string | undefined;
	let id: string | undefined;
	let retry: number | undefined;

	for (const line of frame.split(LINE_BREAK)) {
		// a line starting with a colon is a comment, and an empty one is nothing
		if (line === "" || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const raw = colon === -1 ? "" : line.slice(colon + 1);
		// exactly one leading space belongs to the delimiter, not to the value
		const value = raw.startsWith(" ") ? raw.slice(1) : raw;

		if (field === "data") data = data === null ? value : `${data}\n${value}`;
		else if (field === "event") event = value;
		// a NUL in an id is thrown away rather than remembered, per the format
		else if (field === "id" && !value.includes("\0")) id = value;
		else if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
	}

	if (data === null) return null;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The payload's type is the handler's claim about it; the wire carries no proof either way.
	return { data: parseData(data) as T, event, id, retry };
}

/**
 * The payload as the sender meant it. `sse()` writes JSON, so that is what is
 * tried first; a stream from somewhere else may be sending plain text, and
 * handing that back as a string beats throwing on it.
 */
function parseData(data: string): unknown {
	try {
		return JSON.parse(data);
	} catch {
		return data;
	}
}
