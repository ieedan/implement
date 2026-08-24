import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ManifestSchema, type RemoteDependency } from "jsrepo";
import { expect, it } from "vitest";

/**
 * The built registry, as it is committed. `pnpm registry` writes it, and `changeset:version`
 * rebuilds it in the same command that bumps the packages — so what is on disk here is what a
 * `jsrepo add` installs.
 */
const REGISTRY = resolve(import.meta.dirname, "../registry.json");

/** Where the workspace packages the components import live. */
const PACKAGES = resolve(import.meta.dirname, "../../../packages");

/**
 * A real range and not a dist-tag. `latest` resolves at install time, so two people adding the
 * same component a month apart would get components built against different releases — the same
 * reasoning `create-implement-app` tests over its own version table.
 */
const RANGE = /^[~^]?\d+\.\d+\.\d+/;

/** Every dependency the registry asks a consuming project to install, tagged with the item. */
function dependencies(): Array<{ item: string; dependency: RemoteDependency }> {
	// jsrepo's own schema, so a manifest this app can no longer describe fails here rather than
	// being read through a hand-written shape that quietly stopped matching
	const manifest = ManifestSchema.parse(JSON.parse(readFileSync(REGISTRY, "utf8")));
	if (manifest.type !== "repository") throw new Error("expected a repository manifest");
	return manifest.items.flatMap((item) =>
		[...(item.dependencies ?? []), ...(item.devDependencies ?? [])].map((dependency) => ({
			item: item.name,
			dependency,
		})),
	);
}

/** Every package in the workspace, by the name it publishes under. */
function workspaceVersions(): Map<string, string> {
	const versions = new Map<string, string>();
	for (const dir of readdirSync(PACKAGES)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(resolve(PACKAGES, dir, "package.json"), "utf8"));
		} catch {
			continue;
		}
		const { name, version } = (typeof parsed === "object" && parsed !== null ? parsed : {}) as {
			name?: unknown;
			version?: unknown;
		};
		if (typeof name === "string" && typeof version === "string") versions.set(name, version);
	}
	return versions;
}

function labelled({ item, dependency }: { item: string; dependency: RemoteDependency }): string {
	return `${item}: ${dependency.name}@${dependency.version}`;
}

it("asks for every dependency by a range, never a tag", () => {
	const deps = dependencies();

	// a registry that resolved nothing would pass every assertion here by having nothing to check
	expect(deps.length).toBeGreaterThan(0);
	expect(
		deps.filter(({ dependency }) => !RANGE.test(dependency.version ?? "")).map(labelled),
	).toEqual([]);
});

/**
 * What `@jsrepo/pnpm` is in `jsrepo.config.ts` for. A `workspace:` range means nothing outside this
 * repo, so the resolver rewrites it to the version on disk at build time — the version the
 * components were built against, and the one the `Registry` release job has just published to npm.
 *
 * The tilde comes from the `workspace:~` in this app's `package.json`: on the `0.0.x` line a caret
 * is an exact pin, so a tilde is what leaves room for a patch. Swap both the day these reach a
 * non-zero minor.
 */
it("resolves workspace packages to the version on disk", () => {
	const versions = workspaceVersions();
	const workspaceDeps = dependencies().filter(({ dependency }) => versions.has(dependency.name));

	expect(workspaceDeps.length).toBeGreaterThan(0);
	expect(workspaceDeps.map(labelled)).toEqual(
		workspaceDeps.map(
			({ item, dependency }) => `${item}: ${dependency.name}@~${versions.get(dependency.name)}`,
		),
	);
});
