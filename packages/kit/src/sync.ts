import { join } from "node:path";
import { scanRoutes } from "./scan.ts";
import { DEFAULT_PARAMS_DIR, writeGenerated, type SyncOptions } from "./typegen.ts";

export type { SyncOptions } from "./typegen.ts";

/**
 * What the kit plugin publishes on `plugin.api`. The `implement-kit` CLI loads
 * the app's vite config to find the plugin and syncs with the options it was
 * given, so the options in `vite.config.ts` are the options codegen runs with.
 */
export type KitPluginApi = { options: SyncOptions };

/**
 * Regenerates the `.implement/` directory (entries, tsconfig, `./$types`)
 * without running Vite — for `check` scripts and CI, where `tsc` needs the
 * generated files but no dev server or build has produced them.
 */
export function sync(root: string, options: SyncOptions = {}): void {
	const routes = options.routes ?? "src/routes";
	const params = options.params ?? DEFAULT_PARAMS_DIR;
	writeGenerated(root, scanRoutes(join(root, routes), join(root, params)), options);
}
