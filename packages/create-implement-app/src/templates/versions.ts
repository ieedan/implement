import { MissingLinkedPackageError } from "@/utils/errors";
import type { TemplateContext } from "@/templates/types";

/**
 * Scaffolded apps ask for the latest tag of each implement package, so a new app starts on the
 * current release. Inside the monorepo `--workspace` swaps these for `workspace:*`.
 */
export const IMPLEMENT_VERSION = "latest";

/** Everything a template can put in a generated `package.json`, pinned in one place. */
export const VERSIONS = {
	"@implementjs/core": IMPLEMENT_VERSION,
	"@implementjs/formish": IMPLEMENT_VERSION,
	"@implementjs/kit": IMPLEMENT_VERSION,
	"@implementjs/lucide": IMPLEMENT_VERSION,
	"@implementjs/mode-watcher": IMPLEMENT_VERSION,
	"@implementjs/primitives": IMPLEMENT_VERSION,
	"@tailwindcss/vite": "^4.3.3",
	"@types/node": "^26.2.0",
	jsrepo: "^3.8.1",
	"tailwind-merge": "^3.6.0",
	"tailwind-variants": "^3.3.1",
	tailwindcss: "^4.3.3",
	typescript: "^7.0.2",
	valibot: "^1.4.1",
	vite: "^7.3.0",
	zod: "^4.4.3",
} as const satisfies Record<string, string>;

export type Dependency = keyof typeof VERSIONS;

const IMPLEMENT_SCOPE = "@implementjs/";

/**
 * The specifier a template should ask for. The implement packages answer to `--link` first (a path
 * into a local clone) and then to `--workspace`, everything else is a pinned version.
 *
 * @throws {MissingLinkedPackageError} when `--link` points at a repo missing a package the app needs.
 */
export function version(ctx: TemplateContext, dependency: Dependency): string {
	if (!dependency.startsWith(IMPLEMENT_SCOPE)) return VERSIONS[dependency];
	if (ctx.link) {
		const linked = ctx.link[dependency];
		if (linked === undefined) throw new MissingLinkedPackageError(dependency);
		return linked;
	}
	if (ctx.workspace) return "workspace:*";
	return VERSIONS[dependency];
}

export function dependencies(ctx: TemplateContext, deps: Dependency[]): Record<string, string> {
	// sorted so the generated package.json doesn't depend on the order a template listed its deps
	// eslint-disable-next-line unicorn/no-array-sort -- the spread above already made a copy
	const sorted = [...deps].sort();
	return Object.fromEntries(sorted.map((dependency) => [dependency, version(ctx, dependency)]));
}
