import { buildSearchIndex } from "@/lib/search-index";

/**
 * The docs search index, at `/search.json`.
 *
 * An extension endpoint rather than a bundled module, so the corpus is a file
 * the palette fetches once instead of a chunk every docs route carries. It is
 * prerendered like the `.md` twins beside it, so what ships is a plain static
 * file — no function runs for it on a serverless host, and any CDN can serve
 * it straight from the edge.
 */
export function GET(): Response {
	return new Response(JSON.stringify(buildSearchIndex()), {
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
