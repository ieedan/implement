/**
 * Keeps the versions `create-implement-app` scaffolds with in step with the
 * versions this repo publishes.
 *
 * The CLI writes a caret range for every implement package it puts in a
 * generated `package.json`, and those ranges live in one literal —
 * {@link VERSIONS_FILE}'s `IMPLEMENT_VERSIONS`. Nothing derives them at runtime:
 * the CLI is published on its own and cannot read the rest of the monorepo, so
 * the literal is what ships.
 *
 * `changeset version` bumps every package's `package.json` and knows nothing
 * about that literal, so this runs straight after it and rewrites the ranges
 * from what the bump produced. `--check` reports drift instead of fixing it,
 * which is what CI runs.
 *
 * A run that changes anything is a change to the CLI's output, so the release
 * it lands in wants a changeset for `create-implement-app` too — otherwise the
 * new ranges sit unpublished until its next release.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = "packages";

const VERSIONS_FILE = join(PACKAGES_DIR, "create-implement-app", "src", "templates", "versions.ts");

/** The literal this rewrites, from its opening brace to its closing one. */
const BLOCK = /(export const IMPLEMENT_VERSIONS = \{\n)([\S\s]*?)(\n\} as const)/;

/** One `"@implementjs/name": "^0.0.0",` entry inside that literal. */
const ENTRY = /^(\s*)"(@implementjs\/[^"]+)":\s*"[^"]*",$/;

/** Every workspace package's published version, keyed by package name. */
function workspaceVersions(): Map<string, string> {
	const versions = new Map<string, string>();
	for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const manifest = join(PACKAGES_DIR, entry.name, "package.json");
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(manifest, "utf8"));
		} catch {
			// a directory without a readable package.json is not a package
			continue;
		}
		if (typeof parsed !== "object" || parsed === null) continue;
		const { name, version } = parsed as { name?: unknown; version?: unknown };
		if (typeof name === "string" && typeof version === "string") versions.set(name, version);
	}
	return versions;
}

/** The file with every entry in the literal rewritten to the workspace's version. */
function sync(source: string, versions: Map<string, string>): string {
	const block = BLOCK.exec(source);
	if (!block) {
		throw new Error(`IMPLEMENT_VERSIONS not found in ${VERSIONS_FILE}`);
	}

	const [, open = "", body = "", close = ""] = block;

	const synced = body
		.split("\n")
		.map((line) => {
			const entry = ENTRY.exec(line);
			if (!entry) return line;
			const [, indent = "", pkg = ""] = entry;
			const version = versions.get(pkg);
			if (version === undefined) {
				throw new Error(`${pkg} is listed in ${VERSIONS_FILE} but is not a workspace package`);
			}
			return `${indent}"${pkg}": "^${version}",`;
		})
		.join("\n");

	return source.replace(BLOCK, () => `${open}${synced}${close}`);
}

function main(): void {
	const check = process.argv.slice(2).includes("--check");
	const source = readFileSync(VERSIONS_FILE, "utf8");
	const synced = sync(source, workspaceVersions());

	if (source === synced) {
		console.log(`${VERSIONS_FILE} is in step with the workspace.`);
		return;
	}

	if (check) {
		console.error(
			[
				`${VERSIONS_FILE} is out of step with the versions in ${PACKAGES_DIR}/*/package.json.`,
				"",
				"Run `pnpm sync:versions` and commit the result.",
			].join("\n"),
		);
		process.exitCode = 1;
		return;
	}

	writeFileSync(VERSIONS_FILE, synced);
	console.log(`Updated ${VERSIONS_FILE}.`);
}

main();
