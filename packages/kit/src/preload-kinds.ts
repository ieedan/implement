/**
 * The vocabulary of link preloading: what the attributes and the `preload`
 * plugin option may say, and the names of the attributes themselves.
 *
 * Its own module, and importing nothing, for the same reason `./match.ts` is:
 * both halves of the feature need these names, and the halves run in different
 * places. `./prefetch.ts` is browser code that reaches `@implementjs/core`
 * through the runtime; `./index.ts` is the Vite plugin, which is evaluated
 * inside `vite.config.ts` under plain node. Declaring the option types where
 * the driver lives would put the browser runtime in the type graph of every
 * package that so much as names `KitOptions` — an adapter's `tsc` would start
 * checking `import.meta.env` in a file it has no business reading.
 */

/**
 * How eagerly a link's route data is fetched.
 *
 * - `"hover"` — when the pointer arrives over the link, or it takes keyboard
 *   focus. The default, and what makes a navigation feel instant: on a
 *   desktop the click is ~200ms behind the pointer.
 * - `"tap"` — when the pointer goes *down* on it. Less speculative, and what
 *   a touch device gets from `"hover"` anyway; worth asking for explicitly
 *   when the load behind the link is expensive enough that a pointer merely
 *   crossing it should not run one.
 * - `"off"` — not until the navigation itself.
 */
export type PreloadDataKind = "hover" | "tap" | "off";

/**
 * How eagerly a link's route chunks are fetched. `"hover"`, `"tap"`, and
 * `"off"` mean what they do for data, plus two that only make sense for code,
 * which is immutable and cached for the life of the page:
 *
 * - `"eager"` — as soon as the link is in the document.
 * - `"viewport"` — when the link scrolls into view.
 */
export type PreloadCodeKind = "eager" | "viewport" | "hover" | "tap" | "off";

/** What a link does when nothing above it says otherwise. */
export type PreloadOptions = {
	/** @default "hover" */
	data?: PreloadDataKind;
	/** @default "hover" */
	code?: PreloadCodeKind;
};

/** The attribute a subtree sets to choose its links' {@link PreloadDataKind}. */
export const PRELOAD_DATA_ATTRIBUTE = "data-implement-preload-data";

/** The attribute a subtree sets to choose its links' {@link PreloadCodeKind}. */
export const PRELOAD_CODE_ATTRIBUTE = "data-implement-preload-code";
