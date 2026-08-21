import { createModeManager } from "@implementjs/primitives";

/**
 * The docs site's mode. Module scope so anything can read or change it —
 * `ModeWatcher` in the root layout is what applies it to `<html>`.
 */
export const mode = createModeManager({
	// the palette's --background in each mode, so mobile browser chrome matches
	themeColors: { dark: "#000000", light: "#ffffff" },
});
