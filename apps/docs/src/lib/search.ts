import { computeCommandScore } from "@implementjs/primitives";

/**
 * Full-text search over the docs.
 *
 * Every page's rendered HTML already ships to the browser — the docs render it
 * client-side — so the index is built from that rather than from a second copy
 * of the content: strip the markup, split at the headings rehype-slug already
 * gave ids to, and a page becomes a list of separately linkable sections.
 * Stripping is lazy and cached per page, so nothing is parsed until the first
 * search runs.
 */

/** The shape every content collection shares. */
export type SearchPage = {
	title: string;
	description: string;
	permalink: string;
	/** The page's rendered HTML, as Velite's `s.markdown()` produced it. */
	content: string;
};

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

type Section = {
	/** Heading anchor id; null for the text ahead of the first heading. */
	id: string | null;
	heading: string;
	text: string;
	/** Lower-cased once here so matching never re-cases per keystroke. */
	lowerHeading: string;
	lowerText: string;
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

const sectionCache = new WeakMap<SearchPage, Section[]>();

function sectionsOf(page: SearchPage): Section[] {
	const cached = sectionCache.get(page);
	if (cached) return cached;

	const sections: Section[] = [];
	let cursor = 0;
	let id: string | null = null;
	let heading = "";

	const push = (html: string) => {
		const text = toText(html);
		if (text === "" && heading === "") return;
		sections.push({
			id,
			heading,
			text,
			lowerHeading: heading.toLowerCase(),
			lowerText: text.toLowerCase(),
		});
	};

	for (const match of page.content.matchAll(headingPattern)) {
		push(page.content.slice(cursor, match.index));
		id = match[2] ?? null;
		heading = toText(match[3] ?? "");
		cursor = match.index + match[0].length;
	}
	push(page.content.slice(cursor));

	sectionCache.set(page, sections);
	return sections;
}

/**
 * Strips every page down ahead of the first keystroke. Called when the palette
 * opens so the work lands in the idle moment after the dialog animates in
 * rather than under the first character typed.
 */
export function warmSearchIndex(pages: readonly SearchPage[]): void {
	for (const page of pages) sectionsOf(page);
}

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
	for (const section of sectionsOf(page)) {
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
