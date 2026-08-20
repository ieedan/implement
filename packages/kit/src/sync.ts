import { join } from "node:path";
import { scanRoutes } from "./scan.ts";
import { writeGenerated, type SyncOptions } from "./typegen.ts";

export type { SyncOptions } from "./typegen.ts";

/**
 * Regenerates the `.implement/` directory (entries, tsconfig, `./$types`)
 * without running Vite — for `check` scripts and CI, where `tsc` needs the
 * generated files but no dev server or build has produced them.
 */
export function sync(root: string, options: SyncOptions = {}): void {
	const routes = options.routes ?? "src/routes";
	writeGenerated(root, scanRoutes(join(root, routes)), options);
}
