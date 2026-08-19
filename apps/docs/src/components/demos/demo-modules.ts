import type { ShimModule } from "../../lib/run-lesson";

const uiModules = import.meta.glob<ShimModule>("../ui/*.ts", { eager: true });

/**
 * Extra modules demo code can import beyond the implement packages: every docs
 * ui component, importable as `@/components/ui/<name>` — the same specifier a
 * reader would use after copying the component into their own app.
 */
export const demoModules: Record<string, ShimModule> = {};
for (const [path, mod] of Object.entries(uiModules)) {
	const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.ts$/, "");
	demoModules[`@/components/ui/${name}`] = mod;
}
