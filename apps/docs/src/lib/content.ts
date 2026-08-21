/**
 * The docs content collections, straight from Velite.
 *
 * Re-exports only, and deliberately so: every route imports its own collection
 * from here, and anything with a side effect at module scope — a call Rollup
 * cannot prove pure, a computed `const` — would be retained in each of their
 * chunks and drag its data in with it. Lesson content used to be assembled
 * here and cost every docs route the whole tutorial tree; it lives in
 * `./tutorials` now. Keep this file re-exports.
 */
export {
	create as createPages,
	formish as formishPages,
	kit as kitPages,
	lucide as lucidePages,
	modeWatcher as modeWatcherPages,
	pages,
	primitives as primitivePages,
	ui as uiPages,
	type CreatePage,
	type FormishPage,
	type KitPage,
	type LucidePage,
	type ModeWatcherPage,
	type Page,
	type PrimitivePage,
	type UiPage,
} from "../../.velite";
