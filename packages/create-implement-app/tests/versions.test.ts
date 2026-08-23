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
 * A range and not a dist-tag. `latest` resolves at install time, so the app a CLI scaffolds today
 * would not be the app the same CLI scaffolds a month later.
 */
const RANGE = /^[~^]\d+\.\d+\.\d+$/;

/**
 * What an implement package has to be asked for as, while they are all on `0.0.x`.
 *
 * A caret does not work on this version line: `^0.0.3` is `>=0.0.3 <0.0.4`, an exact pin, so
 * every release would have to be transcribed into `versions.ts` before a new app could reach it.
 * `~0.0.3` is `>=0.0.3 <0.1.0` — a floor that later patches clear on their own.
 *
 * This fails the day these leave `0.0.x`, which is the point: a caret is right from `0.1.0` on,
 * and swapping the sigil should be somebody's decision rather than a silent inheritance.
 */
const FLOOR = /^~0\.0\.\d+$/;

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

describe("IMPLEMENT_VERSIONS", () => {
	it.each(Object.entries(IMPLEMENT_VERSIONS))(
		"%s is a floor later releases clear, not a pin a release has to be written into",
		(_, specifier) => {
			expect(specifier).toMatch(FLOOR);
		},
	);
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
