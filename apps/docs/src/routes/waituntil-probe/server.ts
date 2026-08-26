import type { RequestEvent } from "@implementjs/kit/server";

/**
 * TEMPORARY — proves on a real deployment that the invocation context this
 * branch puts on `event.platform` carries a working `waitUntil`. Removed
 * before this pull request leaves draft; nothing links to it.
 *
 * A `GET` schedules work that flips {@link ran} half a second after the
 * response has gone out, and reports whether an earlier request's work has
 * already landed. Two requests to the same warm instance are the whole test:
 * the second seeing `ranBeforeThisRequest: true` means the promise ran after
 * the first response was sent, which is the thing that cannot be done with a
 * bare `void promise()`.
 */
declare global {
	namespace App {
		interface Platform {
			context?: { waitUntil?: (promise: Promise<unknown>) => void };
		}
	}
}

/** Set by work the response did not wait for. */
let ran = false;

export function GET({ platform }: RequestEvent) {
	const waitUntil = platform?.context?.waitUntil;
	const before = ran;
	waitUntil?.(
		(async () => {
			await new Promise((settle) => setTimeout(settle, 500));
			ran = true;
		})(),
	);
	return Response.json({
		platform: platform !== undefined,
		context: platform?.context !== undefined,
		waitUntil: typeof waitUntil === "function",
		ranBeforeThisRequest: before,
	});
}
