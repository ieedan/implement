import { redirect, type Handle } from "@implementjs/kit/server";
import { markdownTwin } from "@/lib/markdown-pages";

/**
 * Whether the client explicitly asked for markdown. A wildcard doesn't count —
 * every browser's Accept header ends in one, and browsers want the page.
 */
function acceptsMarkdown(accept: string | null): boolean {
	if (accept === null) return false;
	return accept.split(",").some((entry) => {
		const [type, ...parameters] = entry.split(";").map((part) => part.trim().toLowerCase());
		return type === "text/markdown" && !parameters.includes("q=0");
	});
}

/**
 * Content negotiation for the docs. Every docs page has a plain-markdown twin
 * at its own URL plus `.md`, so a client that asks for markdown — an agent, a
 * reader, `curl -H "accept: text/markdown"` — gets sent there instead of the
 * page. Browsers never ask for it, so nothing about the site changes for them.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const markdown = markdownTwin(event.url.pathname);
	if (markdown === null) return await resolve(event);

	if (acceptsMarkdown(event.request.headers.get("accept"))) {
		redirect(303, `${markdown}${event.url.search}`);
	}
	// the page and its markdown answer the same URL, so caches must key on Accept
	event.setHeaders({ vary: "Accept" });
	return await resolve(event);
};
