import type { ShimModule } from "@/lib/run-lesson";

const uiModules = import.meta.glob<ShimModule>("../ui/*.ts", { eager: true });

/**
 * Extra modules demo code can import beyond the implement packages: every docs
 * ui component, importable as `@/components/ui/<name>` (and as
 * `@/lib/components/ui/<name>`, the specifier the demo source files use).
 */
export const demoModules: Record<string, ShimModule> = {};
for (const [path, mod] of Object.entries(uiModules)) {
	const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.ts$/, "");
	demoModules[`@/components/ui/${name}`] = mod;
	demoModules[`@/lib/components/ui/${name}`] = mod;
}
