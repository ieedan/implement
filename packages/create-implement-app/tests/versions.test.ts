import { describe, expect, it } from "vitest";
import { MissingLinkedPackageError } from "@/utils/errors";
import {
	dependencies,
	IMPLEMENT_VERSIONS,
	VERSIONS,
	version,
	type VersionContext,
} from "@/templates/versions";

/**
 * `^0.0.3` — what every entry has to be. A tag like `latest` resolves at install time, so an app
 * scaffolded today would not be the app the same CLI scaffolds tomorrow.
 */
const RANGE = /^\^\d+\.\d+\.\d+$/;

function ctx(overrides: Partial<VersionContext> = {}): VersionContext {
	return { workspace: false, ...overrides };
}

describe("VERSIONS", () => {
	it.each(Object.entries(VERSIONS))("%s is asked for as a range, not a tag", (_, specifier) => {
		expect(specifier).toMatch(RANGE);
	});

	it("answers for the implement packages with what IMPLEMENT_VERSIONS holds", () => {
		expect(VERSIONS).toMatchObject(IMPLEMENT_VERSIONS);
	});
});

describe("version", () => {
	it("gives the pinned range by default", () => {
		expect(version(ctx(), "@implementjs/core")).toBe(VERSIONS["@implementjs/core"]);
		expect(version(ctx(), "vite")).toBe(VERSIONS.vite);
	});

	it("swaps the implement packages for workspace:* with --workspace", () => {
		expect(version(ctx({ workspace: true }), "@implementjs/core")).toBe("workspace:*");
	});

	it("leaves everything else on its version, workspace or not", () => {
		expect(version(ctx({ workspace: true }), "vite")).toBe(VERSIONS.vite);
	});

	it("prefers --link over --workspace", () => {
		const link = { "@implementjs/core": "link:../implement/packages/core" };

		expect(version(ctx({ workspace: true, link }), "@implementjs/core")).toBe(
			"link:../implement/packages/core",
		);
	});

	it("throws when --link is missing a package the app needs", () => {
		expect(() => version(ctx({ link: {} }), "@implementjs/core")).toThrow(
			MissingLinkedPackageError,
		);
	});
});

describe("dependencies", () => {
	it("sorts, so the generated package.json does not depend on the order a template listed", () => {
		const deps = dependencies(ctx(), ["vite", "@implementjs/core", "typescript"]);

		expect(Object.keys(deps)).toEqual(["@implementjs/core", "typescript", "vite"]);
	});
});
