import type { RequestEvent } from "@implementjs/kit/server";

/**
 * Work handed to `waitUntil`, which the response does not wait for. The gate
 * keeps the test off the clock: nothing here finishes until a `DELETE` opens
 * it, so "still running when the response went out" is a fact rather than a
 * race the CI machine gets to decide.
 */
let opened: (() => void) | null = null;
let finished = false;

async function deliver(): Promise<void> {
	await new Promise<void>((open) => {
		opened = open;
	});
	finished = true;
}

/** Whether the scheduled work has run yet. */
export function GET() {
	return Response.json({ finished });
}

/** Schedules the work and answers immediately, the way a webhook route would. */
export function POST({ platform }: RequestEvent) {
	const waitUntil = platform?.context.waitUntil;
	if (waitUntil === undefined) return Response.json({ scheduled: false });
	waitUntil(deliver());
	return Response.json({ scheduled: true });
}

/** Lets the scheduled work finish. */
export function DELETE() {
	opened?.();
	return new Response(null, { status: 204 });
}
