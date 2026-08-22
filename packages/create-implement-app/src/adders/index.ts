import { err, ok, type Result } from "nevereverthrow";
import { oxlint } from "@/adders/oxlint";
import { type Adder, type AdderContext, ADDERS, type AdderId } from "@/adders/types";
import type { TemplateFile } from "@/templates/types";
import { type Dependency, dependencies } from "@/templates/versions";
import type { CLIError } from "@/utils/errors";
import {
	CreateImplementAppError,
	InvalidAdderError,
	InvalidPackageJsonError,
} from "@/utils/errors";

export const adders = {
	oxlint,
} as const satisfies Record<AdderId, Adder>;

export function getAdder(id: AdderId): Adder {
	return adders[id];
}

/** Narrows a raw string — a CLI argument — to an adder, in the canonical order. */
export function parseAdders(names: string[]): Result<AdderId[], InvalidAdderError> {
	for (const name of names) {
		if (!isAdderId(name)) return err(new InvalidAdderError(name, [...ADDERS]));
	}

	// the canonical order, so applying two adders doesn't depend on the order they were typed
	return ok(ADDERS.filter((id) => names.includes(id)));
}

function isAdderId(name: string): name is AdderId {
	return (ADDERS as readonly string[]).includes(name);
}

/** What applying a set of adders does to an app. */
export type AdderChanges = {
	/** The config files to write, relative to the app directory. */
	files: TemplateFile[];
	/** The app's `package.json`, with the dependencies and scripts the adders need. */
	packageJson: string;
	/** The scripts that were added, and the ones the app already had under that name. */
	scripts: string[];
	skippedScripts: string[];
	/** The dependencies that were added, and the ones the app already depended on. */
	dependencies: string[];
	skippedDependencies: string[];
};

type PackageJson = {
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

/**
 * Everything the adders change, as values rather than writes — the caller decides what reaches the
 * disk. Nothing the app already has is touched unless `overwrite` says so, which is what makes
 * running `add` twice, or against an app that half has the adder already, a safe thing to do.
 */
export function applyAdders(
	ids: AdderId[],
	ctx: AdderContext,
	packageJson: string,
	{ overwrite = false }: { overwrite?: boolean } = {},
): Result<AdderChanges, CLIError> {
	const parsed = parsePackageJson(packageJson);
	if (parsed.isErr()) return err(parsed.error);
	const pkg = parsed.value;

	const selected = ids.map((id) => getAdder(id));

	const scripts: string[] = [];
	const skippedScripts: string[] = [];
	const added: Dependency[] = [];
	const addedDev: Dependency[] = [];
	const skippedDependencies: string[] = [];

	for (const adder of selected) {
		for (const [name, command] of Object.entries(adder.scripts ?? {})) {
			const existing = pkg.scripts?.[name];
			// an identical script is already this adder's, so it is neither added nor in the way
			if (existing !== undefined && existing !== command && !overwrite) {
				skippedScripts.push(name);
				continue;
			}
			if (existing === command) continue;
			pkg.scripts = { ...pkg.scripts, [name]: command };
			scripts.push(name);
		}

		for (const dependency of adder.dependencies ?? []) {
			if (has(pkg, dependency)) {
				skippedDependencies.push(dependency);
				continue;
			}
			added.push(dependency);
		}

		for (const dependency of adder.devDependencies ?? []) {
			if (has(pkg, dependency)) {
				skippedDependencies.push(dependency);
				continue;
			}
			addedDev.push(dependency);
		}
	}

	// resolving a specifier throws when `--link` points at a repo missing a package an adder needs,
	// the same way a template does
	try {
		if (added.length > 0) {
			pkg.dependencies = sortKeys({ ...pkg.dependencies, ...dependencies(ctx, added) });
		}
		if (addedDev.length > 0) {
			pkg.devDependencies = sortKeys({ ...pkg.devDependencies, ...dependencies(ctx, addedDev) });
		}
	} catch (e) {
		if (e instanceof CreateImplementAppError) return err(e);
		throw e;
	}

	return ok({
		files: selected.flatMap((adder) => adder.files?.(ctx) ?? []),
		packageJson: stringifyPackageJson(pkg, packageJson),
		scripts,
		skippedScripts,
		dependencies: [...added, ...addedDev],
		skippedDependencies,
	});
}

/** Whether the app already depends on a package, wherever it keeps it. */
function has(pkg: PackageJson, dependency: string): boolean {
	return (
		pkg.dependencies?.[dependency] !== undefined || pkg.devDependencies?.[dependency] !== undefined
	);
}

/** Keeps a merged dependency object in the order {@link dependencies} would have written it. */
function sortKeys(record: Record<string, string>): Record<string, string> {
	// oxlint-disable-next-line unicorn/no-array-sort -- Object.entries already returns a new array
	const entries = Object.entries(record).sort(([a], [b]) => compare(a, b));
	return Object.fromEntries(entries);
}

function compare(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

function parsePackageJson(contents: string): Result<PackageJson, InvalidPackageJsonError> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(contents);
	} catch (e) {
		return err(new InvalidPackageJsonError(e instanceof Error ? e.message : String(e)));
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return err(new InvalidPackageJsonError("it is not an object"));
	}

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fields below are read defensively; anything else is carried through untouched.
	return ok(parsed as PackageJson);
}

/**
 * Written back the way it was found: an app formatted with two spaces keeps two spaces, and the
 * templates' tabs stay tabs. Only the keys the adders touched are different.
 */
function stringifyPackageJson(pkg: PackageJson, original: string): string {
	const json = JSON.stringify(pkg, null, detectIndent(original));
	return original.endsWith("\n") ? `${json}\n` : json;
}

/** The indentation the file already uses, from the first line that is indented at all. */
function detectIndent(contents: string): string {
	const match = /\n([\t ]+)"/.exec(contents);
	return match?.[1] ?? "\t";
}

export { ADDERS, type Adder, type AdderContext, type AdderId };
