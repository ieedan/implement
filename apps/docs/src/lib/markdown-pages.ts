import {
	createPages,
	eslintPages,
	formishPages,
	kitPages,
	lucidePages,
	modeWatcherPages,
	pages,
	primitivePages,
	uiPages,
} from "@/lib/content";

/**
 * Which docs pages have a plain-markdown twin. Every collection below is
 * served by a `.md` [extension endpoint](/kit/server-routes) next to its
 * pages, so `/kit/routing` also answers at `/kit/routing.md`. Lessons have
 * no twin — the tutorial is an editor, not a document.
 */
const collections = [
	pages,
	kitPages,
	primitivePages,
	lucidePages,
	createPages,
	formishPages,
	modeWatcherPages,
	uiPages,
	eslintPages,
];

const permalinks = new Set(
	collections.flatMap((collection) => collection.map((page) => page.permalink)),
);

/** Pathname with no trailing slash, so `/kit/routing/` matches its permalink. */
function normalize(pathname: string): string {
	let path = pathname;
	while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	return path;
}

/** The `.md` twin of a docs page path, or `null` when the path has none. */
export function markdownTwin(pathname: string): string | null {
	const path = normalize(pathname);
	return permalinks.has(path) ? `${path}.md` : null;
}
