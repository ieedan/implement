import type { LoadEvent } from "./$types";

/** Calls this app's own endpoint through `event.api` — in-process, no socket. */
export default async function load({ api }: LoadEvent) {
	const { data, error } = await api.GET("/posts/[id]", {
		params: { id: "7" },
		query: { draft: true },
	});
	if (error !== undefined) return { post: null, failure: error.message };
	return { post: data, failure: null };
}
