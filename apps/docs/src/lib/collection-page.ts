import { Div, Key, P, Span, type Child, type Mountable, type Readable } from "@implementjs/core";
import { contentError } from "./content-error";
import { DocsPage } from "@/lib/views/docs-page";
import { NotFound } from "@/lib/views/not-found";
import type { Page } from "./content";

/**
 * Renders a collection's index page (slug `""`) at the collection's root route.
 * The lookup is deferred to render time so a half-written content tree only
 * costs this one route its content — see `contentError`.
 */
export function CollectionIndexPage(collection: Page[], label: string): Child {
	const page = collection.find((entry) => entry.slug === "");
	if (page == null) {
		contentError(`An index.md is required for the ${label} docs route`);
		return MissingIndex(label);
	}
	return DocsPage(page, collection);
}

function MissingIndex(label: string): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2 py-24" },
		Span({ class: "text-sm font-medium" }, `No index page for ${label}`),
		P(
			{ class: "text-[13px] text-foreground/50" },
			`Add an index.md to the ${label} content directory.`,
		),
	);
}

/**
 * Renders the collection page matching a `[...slug]` param. The catch-all
 * route stays mounted across navigations, so `Key` remounts the page (fresh
 * scroll, fresh head) whenever the slug changes.
 */
export function CollectionPage(slug: Readable<string>, collection: Page[]): Child {
	return Key(slug, () => {
		const page = collection.find((entry) => entry.slug === slug.get());
		return (page ? DocsPage(page, collection) : NotFound())();
	});
}
