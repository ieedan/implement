/**
 * Warming a route before the reader asks for it.
 *
 * A navigation resolves the destination's chunks and its `__data.json` before
 * it commits, so whatever is already resolved when the click lands is time the
 * reader does not spend waiting. Links do this for themselves through the
 * `data-implement-preload-data` and `data-implement-preload-code` attributes —
 * see the [preloading guide](https://implementjs.dev/kit/preloading). These
 * are the same two operations, for the navigations markup cannot predict.
 *
 * ```ts
 * import { preloadCode, preloadData } from "@implementjs/kit/navigation";
 *
 * // the wizard's next step, warmed while the reader fills in this one
 * onMount(() => void preloadData("/checkout/payment"));
 * ```
 */

export { preloadCode, preloadData, type RouteData } from "./runtime.ts";

export {
	initPreloading,
	PRELOAD_CODE_ATTRIBUTE,
	PRELOAD_DATA_ATTRIBUTE,
	type PreloadCodeKind,
	type PreloadDataKind,
	type PreloadOptions,
} from "./prefetch.ts";
