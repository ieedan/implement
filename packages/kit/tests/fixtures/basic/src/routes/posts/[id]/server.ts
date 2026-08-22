import * as z from "zod";
import { handler } from "./$types";

/** No response schema — the client's `data` type comes from what `handle` returns. */
export const GET = handler({
	query: z.object({ draft: z.stringbool().default(false) }),
	handle: ({ params, query }) => ({ id: params.id, draft: query.draft }),
});

/** A declared response, and params coerced past `string`. */
export const PATCH = handler({
	params: z.object({ id: z.coerce.number() }),
	body: z.object({ title: z.string() }),
	response: z.object({ id: z.number(), title: z.string() }),
	handle: ({ params, body }) => ({ id: params.id, title: body.title }),
});

/** A plain handler in the same file, untouched. */
export function HEAD(): Response {
	return new Response(null, { status: 200 });
}
