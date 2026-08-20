/**
 * Reports a content problem that is a real error in a finished tree but only a
 * transient one while the tree is being written — an `index.md` that doesn't
 * exist yet, a lesson whose `code.ts` hasn't landed. Velite's watcher rebuilds
 * a collection from a fresh glob, so any moment a file is missing from disk it
 * is missing from the collection, and the generated router statically imports
 * every route: throwing at module scope from one route blanks the whole site
 * until the file comes back.
 *
 * So this only warns, and the affected page renders a placeholder. Builds stay
 * honest through `entries()` in `vite.config.ts`, which checks the collections
 * for their index page before prerendering.
 */
export function contentError(message: string): void {
	console.warn(`[content] ${message}`);
}
