import { handler } from "./$types";

/**
 * `number` is a built-in matcher, so nothing in `src/params` declares it and
 * `params.at` is still a `number` — the arithmetic here is the proof.
 */
export const GET = handler({
	handle: ({ params }) => ({ at: params.at, halved: params.at / 2 }),
});
