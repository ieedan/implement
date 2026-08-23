import { handler } from "./$types";

/** What an `/orders/<anything else>` falls through to. */
export const GET = handler({
	handle: ({ params }) => ({ slug: params.slug }),
});
