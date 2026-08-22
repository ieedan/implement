import * as v from "valibot";
import { areaKeys, buildSearchIndex } from "@/lib/search-index";
import { handler } from "./$types";

/**
 * The docs search index, at `/search.json`.
 *
 * An extension endpoint rather than a bundled module, so the corpus is a file
 * the palette fetches once instead of a chunk every docs route carries. It is
 * prerendered like the `.md` twins beside it, so what ships is a plain static
 * file — no function runs for it on a serverless host, and any CDN can serve
 * it straight from the edge.
 *
 * `area` narrows it to one section of the docs. It has to be optional for the
 * same reason: the prerender asks for `/search.json` with no query at all, and
 * that request is the file the site ships.
 */
export const GET = handler({
	query: v.object({ area: v.optional(v.picklist(areaKeys)) }),
	handle: ({ query }) => buildSearchIndex(query.area),
});
