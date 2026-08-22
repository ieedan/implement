/**
 * Rejects changesets that would take a release past the version line the repo
 * is on.
 *
 * Everything here is versioned `0.0.x`, so the next release is `0.0.1` and the
 * only bump that belongs in a changeset is `patch`. A `minor` would land on
 * `0.1.0` and a `major` on `1.0.0` — both easy to write without meaning to,
 * and neither is recoverable once it has been published under that number.
 *
 * The pre-commit hook runs this over the changesets a commit is adding. Run it
 * across the whole directory by hand with `--all`.
 *
 * Moving the line later is one edit: add the level to {@link ALLOWED_BUMPS}.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

/** The bump levels a changeset in this repo may ask for. */
const ALLOWED_BUMPS = new Set(["patch"]);

const CHANGESET_DIR = ".changeset";

/** Files in `.changeset` that are configuration rather than a changeset. */
const NOT_A_CHANGESET = new Set(["README.md"]);

type Offense = { file: string; pkg: string; bump: string };

/** `"@implementjs/core": patch`, quoted or not, as changeset frontmatter writes it. */
const BUMP_LINE = /^\s*(?:"([^"]+)"|'([^']+)'|([^:\s]+))\s*:\s*(major|minor|patch)\s*$/;

/** Every `package: bump` pair in a changeset's frontmatter. */
function bumpsIn(source: string): Array<{ pkg: string; bump: string }> {
	const lines = source.split("\n");
	if (lines[0]?.trim() !== "---") return [];
	const end = lines.indexOf("---", 1);
	if (end === -1) return [];
	const bumps: Array<{ pkg: string; bump: string }> = [];
	for (const line of lines.slice(1, end)) {
		const match = BUMP_LINE.exec(line);
		if (!match) continue;
		const [, doubleQuoted, singleQuoted, bare, bump] = match;
		const pkg = doubleQuoted ?? singleQuoted ?? bare;
		if (pkg !== undefined && bump !== undefined) bumps.push({ pkg, bump });
	}
	return bumps;
}

function git(args: string[]): string {
	return execFileSync("git", args, { encoding: "utf8" });
}

/** The changesets a commit is about to add, read out of the index rather than
 * the working tree — the index is what is actually being committed. */
function staged(): Array<{ file: string; source: string }> {
	const output = git([
		"diff",
		"--cached",
		"--name-only",
		"--diff-filter=ACMR",
		"-z",
		"--",
		CHANGESET_DIR,
	]);
	return output
		.split("\0")
		.filter((file) => file.endsWith(".md") && !NOT_A_CHANGESET.has(basename(file)))
		.map((file) => ({ file, source: git(["show", `:${file}`]) }));
}

/** Every changeset on disk. */
function all(): Array<{ file: string; source: string }> {
	let entries: string[];
	try {
		entries = readdirSync(CHANGESET_DIR);
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.endsWith(".md") && !NOT_A_CHANGESET.has(entry))
		.map((entry) => {
			const file = join(CHANGESET_DIR, entry);
			return { file, source: readFileSync(file, "utf8") };
		});
}

const changesets = process.argv.includes("--all") ? all() : staged();

const offenses: Offense[] = [];
for (const { file, source } of changesets) {
	for (const { pkg, bump } of bumpsIn(source)) {
		if (!ALLOWED_BUMPS.has(bump)) offenses.push({ file, pkg, bump });
	}
}

if (offenses.length > 0) {
	const allowed = [...ALLOWED_BUMPS].join(", ");
	console.error(`\nA changeset asks for a bump this repo does not take.\n`);
	// a repo-wide changeset names every package, so report it as one line per
	// bump level rather than one line per package
	for (const file of new Set(offenses.map((offense) => offense.file))) {
		console.error(`  ${file}`);
		const here = offenses.filter((offense) => offense.file === file);
		for (const bump of new Set(here.map((offense) => offense.bump))) {
			const packages = here.filter((offense) => offense.bump === bump).map((o) => o.pkg);
			console.error(`    ${bump}: ${packages.join(", ")}`);
		}
	}
	console.error(
		`\nThe packages are on 0.0.x, so the next release is 0.0.1 and only ${allowed} belongs\n` +
			`in a changeset. A minor would publish 0.1.0 and a major 1.0.0.\n\n` +
			`Change the bumps to ${allowed}, or raise ALLOWED_BUMPS in scripts/check-changesets.ts\n` +
			`if the version line really is moving.\n`,
	);
	process.exit(1);
}
