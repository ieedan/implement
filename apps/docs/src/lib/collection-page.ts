import { Key, type Child, type Readable } from "@implementjs/core";
import { DocsPage } from "@/lib/views/docs-page";
import { NotFound } from "@/lib/views/not-found";
import type { Page } from "./content";

/** The collection's index page (slug `""`), required for the collection's root route. */
export function collectionIndex(collection: Page[], label: string): Page {
	const page = collection.find((entry) => entry.slug === "");
	if (page == null) {
		throw new Error(`An index.md is required for the ${label} docs route`);
	}
	return page;
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
