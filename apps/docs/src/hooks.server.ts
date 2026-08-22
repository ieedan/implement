import { redirect, type Handle } from "@implementjs/kit/server";
import { markdownTwin } from "@/lib/markdown-pages";

const MARKDOWN = "text/markdown";

/**
 * Whether the client explicitly asked for markdown. A wildcard doesn't count —
 * every browser's Accept header ends in one, and browsers want the page. The
 * substring check answers the common case (no mention of markdown at all)
 * before anything gets parsed.
 */
function acceptsMarkdown(accept: string | null): boolean {
	if (accept === null || !accept.includes(MARKDOWN)) return false;
	return accept.split(",").some((entry) => {
		const [type, ...parameters] = entry.split(";").map((part) => part.trim().toLowerCase());
		return type === MARKDOWN && !parameters.includes("q=0");
	});
}

/**
 * Pages that used to live somewhere else. The prerender no longer writes these
 * paths, so a request for one reaches the function and lands here — which is
 * the only place a redirect can be put: the Vercel adapter ships a Build Output
 * API directory, and `vercel.json`'s own `redirects` are ignored for those.
 */
const moved: Record<string, string> = {
	"/docs/linting": "/eslint",
	"/docs/linting.md": "/eslint.md",
};

/**
 * Content negotiation for the docs. Every docs page has a plain-markdown twin
 * at its own URL plus `.md`, so a client that asks for markdown — an agent, a
 * reader, `curl -H "accept: text/markdown"` — gets sent there instead of the
 * page. Browsers never ask for it, so nothing about the site changes for them,
 * and nothing but the header is read on the way past.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const destination = moved[event.url.pathname];
	if (destination !== undefined) redirect(308, `${destination}${event.url.search}`);

	if (acceptsMarkdown(event.request.headers.get("accept"))) {
		const markdown = markdownTwin(event.url.pathname);
		if (markdown !== null) {
			// a cache must not replay this redirect for a request that wanted the page
			event.setHeaders({ vary: "Accept" });
			redirect(303, `${markdown}${event.url.search}`);
		}
	}
	return await resolve(event);
};
