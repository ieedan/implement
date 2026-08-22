import fs from "node:fs";
import { err, ok, type Result } from "nevereverthrow";
import { NoLinkedPackagesError } from "@/utils/errors";
import { exists, readdirSync } from "@/utils/fs";
import { joinAbsolute, shortestPath } from "@/utils/path";
import type { AbsolutePath } from "@/utils/types";

/** The scope every linkable implement package lives under. */
const IMPLEMENT_SCOPE = "@implementjs/";

/**
 * `link:` symlinks the directory in place, which is what local framework development wants. npm and
 * bun spell that `file:`; pnpm, yarn, and deno spell it `link:` (and read `file:` as a tarball-ish
 * copy instead).
 */
export function linkProtocol(packageManager: string): string {
	return packageManager === "npm" || packageManager === "bun" ? "file:" : "link:";
}

/**
 * Every published `@implementjs/*` package in a local clone of the implement repo, keyed by package
 * name. Looks at `packages/*` and at the root itself, so `--link ../implement` and
 * `--link ../implement/packages/core` both work.
 */
export function findLinkablePackages(
	root: AbsolutePath,
): Result<Map<string, AbsolutePath>, NoLinkedPackagesError> {
	const found = new Map<string, AbsolutePath>();

	const consider = (dir: AbsolutePath) => {
		const name = linkableName(dir);
		if (name?.startsWith(IMPLEMENT_SCOPE)) found.set(name, dir);
	};

	consider(root);

	const packagesDir = joinAbsolute(root, "packages");
	if (exists(packagesDir)) {
		const entries = readdirSync(packagesDir);
		if (entries.isOk()) {
			for (const entry of entries.value) consider(joinAbsolute(packagesDir, entry));
		}
	}

	if (found.size === 0) return err(new NoLinkedPackagesError(root));

	return ok(found);
}

/**
 * The specifiers a generated `package.json` should use, spelled relative to the app when that reads
 * better than the absolute path so the links survive the pair being moved together.
 */
export function linkSpecifiers({
	packages,
	appDirectory,
	packageManager,
}: {
	packages: Map<string, AbsolutePath>;
	appDirectory: AbsolutePath;
	packageManager: string;
}): Record<string, string> {
	const protocol = linkProtocol(packageManager);

	return Object.fromEntries(
		[...packages].map(([name, dir]) => [name, `${protocol}${shortestPath(appDirectory, dir)}`]),
	);
}

/**
 * The name a directory can be linked under, or `undefined` if it cannot be linked at all. A private
 * package is one npm never has, so a `link:` specifier naming it would resolve for exactly as long
 * as the clone stays where it is — `@implementjs/ui` is one of those: a jsrepo registry whose
 * package in the workspace carries nothing but its version.
 */
function linkableName(dir: AbsolutePath): string | undefined {
	const packagePath = joinAbsolute(dir, "package.json");
	if (!exists(packagePath)) return undefined;

	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(packagePath, "utf8"));
		if (typeof parsed !== "object" || parsed === null) return undefined;
		const { name, private: isPrivate } = parsed as { name?: unknown; private?: unknown };
		if (isPrivate === true) return undefined;
		return typeof name === "string" ? name : undefined;
	} catch {
		// a package.json we can't read is a package we can't link
		return undefined;
	}
}
