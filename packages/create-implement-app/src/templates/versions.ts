import type { TemplateContext } from "@/templates/types";

/**
 * implement isn't published to a registry yet, so scaffolded apps ask for the latest tag and get it
 * the moment the packages land. Inside the monorepo `--workspace` swaps these for `workspace:*`.
 */
export const IMPLEMENT_VERSION = "latest";

/** Everything a template can put in a generated `package.json`, pinned in one place. */
export const VERSIONS = {
	"@implementjs/core": IMPLEMENT_VERSION,
	"@implementjs/kit": IMPLEMENT_VERSION,
	"@implementjs/lucide": IMPLEMENT_VERSION,
	"@implementjs/primitives": IMPLEMENT_VERSION,
	"@tailwindcss/vite": "^4.3.3",
	"@types/node": "^26.2.0",
	tailwindcss: "^4.3.3",
	typescript: "^7.0.2",
	vite: "^7.3.0",
} as const satisfies Record<string, string>;

export type Dependency = keyof typeof VERSIONS;

/** The version range a template should ask for, honoring `--workspace` for the implement packages. */
export function version(ctx: TemplateContext, dependency: Dependency): string {
	if (ctx.workspace && dependency.startsWith("@implementjs/")) return "workspace:*";
	return VERSIONS[dependency];
}

export function dependencies(ctx: TemplateContext, deps: Dependency[]): Record<string, string> {
	// sorted so the generated package.json doesn't depend on the order a template listed its deps
	// eslint-disable-next-line unicorn/no-array-sort -- the spread above already made a copy
	const sorted = [...deps].sort();
	return Object.fromEntries(sorted.map((dependency) => [dependency, version(ctx, dependency)]));
}
