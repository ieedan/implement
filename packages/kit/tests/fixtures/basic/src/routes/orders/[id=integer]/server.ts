import { handler } from "./$types";

/** `params.id` is a `number` here — the matcher parsed it on the way in. */
export const GET = handler({
	handle: ({ params }) => ({ id: params.id, doubled: params.id * 2 }),
});
