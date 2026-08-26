import { handler, sse } from "./$types";

/**
 * A live event stream, which is what a `server.ts` looks like when the answer
 * is not one body. It ends on its own after three ticks so a test can read it
 * to the end; a real one ends when its source does.
 */
export const GET = handler({
	handle: () =>
		sse<{ n: number }>(
			async function* () {
				for (const n of [1, 2, 3]) yield { event: "tick", id: String(n), data: { n } };
			},
			{ keepAlive: false },
		),
});
