import { computeCommandScore } from "@implementjs/primitives";

/**
 * Full-text search over the docs, matched against a prebuilt index.
 *
 * The index used to be built in the browser from the rendered HTML of every
 * page, on the grounds that the docs ship that HTML anyway. Route
 * code-splitting ended that: a route ships its own collection and nothing
 * else, so reading every collection here made the search palette the one
 * reason all of them were loaded on every page. The stripping now happens at
 * build time instead ({@link ./search-index.ts}) and the result is served as a
 * static file the palette fetches the first time it opens — see
 * `src/routes/search/.json/server.ts`.
 *
 * This module holds the wire format both ends agree on, plus the matching and
 * ranking, which run against the fetched index and never touch content
 * modules.
 */

/** A run of page text under one heading, as the index stores it. */
export type IndexedSection = {
	/** Heading anchor id, from rehype-slug; null for text ahead of the first heading. */
	id: string | null;
	heading: string;
	text: string;
};

/** One page in the index. Carries no rendered HTML — only the text to match. */
export type IndexedPage = {
	title: string;
	description: string;
	permalink: string;
	sections: IndexedSection[];
};

/** One part of the docs, and every page under it. */
export type IndexedArea = {
	key: string;
	label: string;
	/** Whether kit serves a `.md` twin next to these pages (lessons have none). */
	markdown: boolean;
	pages: IndexedPage[];
};

/** The whole served index, exactly as `/search.json` holds it. */
export type SearchIndex = IndexedArea[];

/** An indexed section with the cases matching needs, folded once on load. */
type Section = IndexedSection & {
	/** Lower-cased once here so matching never re-cases per keystroke. */
	lowerHeading: string;
	lowerText: string;
};

export type SearchPage = Omit<IndexedPage, "sections"> & { sections: Section[] };
export type SearchArea = Omit<IndexedArea, "pages"> & { pages: SearchPage[] };

/**
 * Folds the fetched index into the shape matching wants. One pass over the
 * whole corpus, done once when the index lands rather than per keystroke —
 * and the index ships in its original case so results can quote it back.
 */
export function prepareSearchIndex(index: SearchIndex): SearchArea[] {
	return index.map((area) => ({
		...area,
		pages: area.pages.map((page) => ({
			...page,
			sections: page.sections.map((section) => ({
				...section,
				lowerHeading: section.heading.toLowerCase(),
				lowerText: section.text.toLowerCase(),
			})),
		})),
	}));
}

/** A run of result text. `match` marks the part the query hit. */
export type HighlightPart = { text: string; match: boolean };

export type SearchResult = {
	page: SearchPage;
	/** The page permalink, with the section anchor for a content hit. */
	href: string;
	/** The heading the hit sits under, or null for a title/description hit. */
	heading: string | null;
	title: HighlightPart[];
	/** The page description, or a snippet of the matching section. */
	detail: HighlightPart[];
	score: number;
};

function terms(query: string): string[] {
	const seen = new Set(
		query
			.toLowerCase()
			.split(/\s+/)
			.filter((term) => term !== ""),
	);
	return [...seen];
}

/** Splits `text` at every occurrence of any term, merging overlapping hits. */
function highlight(text: string, queryTerms: string[]): HighlightPart[] {
	if (queryTerms.length === 0) return [{ text, match: false }];

	const lower = text.toLowerCase();
	const ranges: { start: number; end: number }[] = [];
	for (const term of queryTerms) {
		let index = lower.indexOf(term);
		while (index !== -1) {
			ranges.push({ start: index, end: index + term.length });
			index = lower.indexOf(term, index + term.length);
		}
	}
	if (ranges.length === 0) return [{ text, match: false }];
	ranges.sort((a, b) => a.start - b.start);

	const parts: HighlightPart[] = [];
	let cursor = 0;
	for (const range of ranges) {
		if (range.end <= cursor) continue;
		const start = Math.max(range.start, cursor);
		if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
		parts.push({ text: text.slice(start, range.end), match: true });
		cursor = range.end;
	}
	if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
	return parts;
}

const SNIPPET_LENGTH = 160;
/** Context kept ahead of the hit, so the highlight lands near the line's start. */
const SNIPPET_LEAD = 32;

/** A window of `text` around the first hit, ellipsed where it was cut. */
function snippet(section: Section, queryTerms: string[]): HighlightPart[] {
	let anchor = 0;
	let longest = 0;
	for (const term of queryTerms) {
		const index = section.lowerText.indexOf(term);
		if (index === -1 || term.length <= longest) continue;
		anchor = index;
		longest = term.length;
	}

	let start = Math.max(0, anchor - SNIPPET_LEAD);
	// step back to a word boundary so the snippet does not open mid-word
	if (start > 0) {
		const space = section.text.lastIndexOf(" ", start);
		if (space !== -1 && start - space < 16) start = space + 1;
	}
	const end = Math.min(section.text.length, start + SNIPPET_LENGTH);

	const parts = highlight(section.text.slice(start, end), queryTerms);
	if (start > 0) parts.unshift({ text: "…", match: false });
	if (end < section.text.length) parts.push({ text: "…", match: false });
	return parts;
}

function matchesEvery(section: Section, queryTerms: string[]): boolean {
	return queryTerms.every(
		(term) => section.lowerText.includes(term) || section.lowerHeading.includes(term),
	);
}

/**
 * Hits sort into tiers, and only ties inside a tier are settled by the score
 * itself. The bottom tier is the fuzzy title match Command used to filter on
 * its own: it earns its keep on typos and initials ("dw" for "Derived &
 * Watch"), but it also matches almost anything given enough letters, so a page
 * that really contains the words the reader typed now outranks it.
 */
/**
 * A title that *is* the query beats one that merely contains it. Without this
 * the two score identically — "button" tied Button with Button Group — and the
 * winner came down to collection order.
 */
const EXACT_TITLE_TIER = 4000;
const TITLE_TIER = 3000;
const DESCRIPTION_TIER = 2000;
const CONTENT_TIER = 1000;

/** One page cannot crowd the rest out with its own sections. */
const SECTIONS_PER_PAGE = 3;
/** A single character appears in nearly every page, so content search waits for two. */
const MIN_CONTENT_QUERY = 2;

/**
 * Every hit `query` has in `page`: the page itself when the query matches its
 * title or description, then the sections whose text contains every term. A
 * section already covered by the page hit is left out rather than repeated.
 */
export function searchPage(page: SearchPage, query: string): SearchResult[] {
	const queryTerms = terms(query);
	const phrase = query.trim().toLowerCase();
	const results: SearchResult[] = [];
	const covered = new Set<string>();

	const titleScore = computeCommandScore(page.title, query, [page.description]);
	if (titleScore > 0) {
		const lowerTitle = page.title.toLowerCase();
		const tier =
			lowerTitle === phrase
				? EXACT_TITLE_TIER
				: lowerTitle.includes(phrase)
					? TITLE_TIER
					: page.description.toLowerCase().includes(phrase)
						? DESCRIPTION_TIER
						: 0;
		results.push({
			page,
			href: page.permalink,
			heading: null,
			title: highlight(page.title, queryTerms),
			detail: highlight(page.description, queryTerms),
			score: tier + titleScore,
		});
		covered.add(page.permalink);
	}

	if (phrase.length < MIN_CONTENT_QUERY) return results;

	const sections: SearchResult[] = [];
	for (const section of page.sections) {
		if (!matchesEvery(section, queryTerms)) continue;
		// the text ahead of the first heading has no anchor to land on, so it
		// stands for the page itself
		const lead = section.id === null;
		const href = lead ? page.permalink : `${page.permalink}#${section.id}`;
		if (covered.has(href)) continue;
		covered.add(href);
		// a hit in the heading is a better answer than the same hit buried in prose
		const headingHits = queryTerms.filter((term) => section.lowerHeading.includes(term)).length;
		sections.push({
			page,
			href,
			heading: lead ? null : section.heading,
			title: highlight(lead ? page.title : section.heading, queryTerms),
			detail: snippet(section, queryTerms),
			score: CONTENT_TIER + headingHits / queryTerms.length,
		});
	}
	sections.sort((a, b) => b.score - a.score);
	results.push(...sections.slice(0, SECTIONS_PER_PAGE));

	return results;
}

/** Every page as a plain result, for the palette's resting state. */
export function listPages(pages: readonly SearchPage[]): SearchResult[] {
	return pages.map((page) => ({
		page,
		href: page.permalink,
		heading: null,
		title: [{ text: page.title, match: false }],
		detail: [{ text: page.description, match: false }],
		score: 0,
	}));
}

/** Ranked hits across `pages`; an empty query lists them all, unranked. */
export function searchPages(pages: readonly SearchPage[], query: string): SearchResult[] {
	if (query.trim() === "") return listPages(pages);
	const hits = pages.flatMap((page) => searchPage(page, query));
	hits.sort((a, b) => b.score - a.score);
	return hits;
}
