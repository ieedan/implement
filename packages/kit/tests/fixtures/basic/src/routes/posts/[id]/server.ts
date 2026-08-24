import * as v from "valibot";
import { handler } from "./$types";

/** No response schema — the client's `data` type comes from what `handle` returns. */
export const GET = handler({
	query: v.object({
		draft: v.optional(
			v.pipe(
				v.picklist(["true", "false"]),
				v.transform((value) => value === "true"),
			),
			"false",
		),
	}),
	handle: ({ params, query }) => ({ id: params.id, draft: query.draft }),
});

/** A declared response, and params parsed past `string`. */
export const PATCH = handler({
	params: v.object({ id: v.pipe(v.string(), v.transform(Number), v.number()) }),
	body: v.object({ title: v.string() }),
	response: v.object({ id: v.number(), title: v.string() }),
	handle: ({ params, body }) => ({ id: params.id, title: body.title }),
});

/** A plain handler in the same file, untouched. */
export function HEAD(): Response {
	return new Response(null, { status: 200 });
}
