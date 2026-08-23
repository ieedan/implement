import { MissingLinkedPackageError } from "@/utils/errors";
import type { TemplateContext } from "@/templates/types";

/**
 * The implement packages, at the lowest release a scaffolded app may start on. These are floors,
 * not pins: `~0.0.3` is `>=0.0.3 <0.1.0`, so an app installs whatever patch is newest at install
 * time and never a minor.
 *
 * A tilde and not a caret, which on this version line is the whole point — `^0.0.3` is
 * `>=0.0.3 <0.0.4`, an exact pin, so every release would need a new number written in here.
 * A tilde is a floor a release moves past on its own.
 *
 * So nothing here changes when a package is published. Raise a floor when a template starts
 * using something the older release does not have, and swap the whole line for `^0.1.0` once
 * these leave `0.0.x` — a caret is the right sigil the moment there is a non-zero minor.
 *
 * Inside the monorepo `--workspace` swaps these for `workspace:*` and `--link` for a path, so
 * neither reads a version at all.
 */
export const IMPLEMENT_VERSIONS = {
	"@implementjs/core": "~0.0.3",
	"@implementjs/eslint": "~0.0.1",
	"@implementjs/formish": "~0.0.3",
	"@implementjs/kit": "~0.0.4",
	"@implementjs/lucide": "~0.0.3",
	"@implementjs/mode-watcher": "~0.0.3",
	"@implementjs/primitives": "~0.0.3",
	"@implementjs/router": "~0.0.4",
} as const satisfies Record<string, string>;

/** Everything a template can put in a generated `package.json`, spelled in one place. */
export const VERSIONS = {
	...IMPLEMENT_VERSIONS,
	"@tailwindcss/vite": "^4.3.3",
	"@types/node": "^26.2.0",
	jsrepo: "^3.8.1",
	oxfmt: "^0.63.0",
	oxlint: "^1.78.0",
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
 * What {@link version} needs to answer. A {@link TemplateContext} is one, and so is the context an
 * adder is applied with — `add` into an existing app knows nothing about the template it was
 * scaffolded from, but it still has to spell the implement packages the same way.
 */
export type VersionContext = Pick<TemplateContext, "workspace" | "link">;

/**
 * The specifier a template should ask for. The implement packages answer to `--link` first (a path
 * into a local clone) and then to `--workspace`, everything else is a pinned version.
 *
 * @throws {MissingLinkedPackageError} when `--link` points at a repo missing a package the app needs.
 */
export function version(ctx: VersionContext, dependency: Dependency): string {
	if (!dependency.startsWith(IMPLEMENT_SCOPE)) return VERSIONS[dependency];
	if (ctx.link) {
		const linked = ctx.link[dependency];
		if (linked === undefined) throw new MissingLinkedPackageError(dependency);
		return linked;
	}
	if (ctx.workspace) return "workspace:*";
	return VERSIONS[dependency];
}

export function dependencies(ctx: VersionContext, deps: Dependency[]): Record<string, string> {
	// sorted so the generated package.json doesn't depend on the order a template listed its deps
	// eslint-disable-next-line unicorn/no-array-sort -- the spread above already made a copy
	const sorted = [...deps].sort();
	return Object.fromEntries(sorted.map((dependency) => [dependency, version(ctx, dependency)]));
}
