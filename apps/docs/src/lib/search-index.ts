import {
	formishPages,
	kitPages,
	lucidePages,
	modeWatcherPages,
	pages,
	primitivePages,
	uiPages,
} from "./content";
import type { IndexedArea, IndexedPage, IndexedSection, SearchIndex } from "./search";
import { tutorials } from "./tutorials";

/**
 * Builds the docs search index the palette fetches.
 *
 * Runs at build time only — the `/search.json` endpoint is prerendered, so
 * this module and the content collections it reads never reach the browser.
 * That is the whole point: a page's rendered HTML is mostly Shiki's per-token
 * markup, which is worthless to search and roughly four times the weight of
 * the text inside it. Stripping it here means the palette downloads the text
 * and nothing else, once, instead of every route paying for every collection.
 *
 * The shape it strips down to is the same one the browser used to derive at
 * runtime: a page becomes its title and description plus a list of sections
 * split at the headings rehype-slug gave ids to, so each one is separately
 * linkable.
 */

/** The shape every content collection shares, as far as indexing cares. */
type ContentPage = {
	title: string;
	description: string;
	permalink: string;
	/** The page's rendered HTML, as Velite's `s.markdown()` produced it. */
	content: string;
};

/** Headings carry the ids rehype-slug generated, which the anchors reuse. */
const headingPattern = /<h([23]) id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g;
/** Ends of block elements, which separate words the way whitespace does. */
const blockEndPattern = /<\/(?:p|h[1-6]|li|pre|blockquote|div|td|th|tr|table|ul|ol)>|<br\s*\/?>/gi;
const tagPattern = /<[^>]+>/g;
const entityPattern = /&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi;

function decodeEntities(value: string): string {
	return value.replace(entityPattern, (entity, decimal?: string, hex?: string, named?: string) => {
		if (decimal != null) return String.fromCodePoint(Number(decimal));
		if (hex != null) return String.fromCodePoint(Number.parseInt(hex, 16));
		switch (named?.toLowerCase()) {
			case "amp":
				return "&";
			case "lt":
				return "<";
			case "gt":
				return ">";
			case "quot":
				return '"';
			case "apos":
				return "'";
			case "nbsp":
				return " ";
			default:
				return entity;
		}
	});
}

/**
 * The text a reader sees, from the HTML they see it in. Inline tags close up
 * (`<code>signal</code>` stays one word) while block ends become whitespace,
 * so nothing runs together across a paragraph or a line of a code block.
 */
function toText(html: string): string {
	return decodeEntities(html.replace(blockEndPattern, "\n").replace(tagPattern, ""))
		.replace(/\s+/g, " ")
		.trim();
}

function sectionsOf(page: ContentPage): IndexedSection[] {
	const sections: IndexedSection[] = [];
	let cursor = 0;
	let id: string | null = null;
	let heading = "";

	const push = (html: string) => {
		const text = toText(html);
		if (text === "" && heading === "") return;
		sections.push({ id, heading, text });
	};

	for (const match of page.content.matchAll(headingPattern)) {
		push(page.content.slice(cursor, match.index));
		id = match[2] ?? null;
		heading = toText(match[3] ?? "");
		cursor = match.index + match[0].length;
	}
	push(page.content.slice(cursor));

	return sections;
}

function indexPage(page: ContentPage): IndexedPage {
	return {
		title: page.title,
		description: page.description,
		permalink: page.permalink,
		sections: sectionsOf(page),
	};
}

/**
 * The parts of the docs the palette offers as filters, in the order its chips
 * render. Defined here rather than in the palette so the areas and their
 * pages cannot drift apart — the client renders whatever the index names.
 */
const areas: { key: string; label: string; markdown: boolean; collection: ContentPage[] }[] = [
	{ key: "lib", label: "@implementjs/core", markdown: true, collection: pages },
	{ key: "kit", label: "@implementjs/kit", markdown: true, collection: kitPages },
	{
		key: "primitives",
		label: "@implementjs/primitives",
		markdown: true,
		collection: primitivePages,
	},
	{ key: "ui", label: "@implementjs/ui", markdown: true, collection: uiPages },
	{ key: "formish", label: "@implementjs/formish", markdown: true, collection: formishPages },
	{ key: "lucide", label: "@implementjs/lucide", markdown: true, collection: lucidePages },
	{
		key: "mode-watcher",
		label: "@implementjs/mode-watcher",
		markdown: true,
		collection: modeWatcherPages,
	},
	// lessons are an editor rather than a document, so they have no `.md` twin
	{ key: "tutorial", label: "Tutorial", markdown: false, collection: tutorials },
];

export function buildSearchIndex(): SearchIndex {
	return areas.map(({ collection, ...area }): IndexedArea => ({
		...area,
		pages: collection.map(indexPage),
	}));
}
