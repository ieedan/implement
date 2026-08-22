import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/**
 * The signals page quotes the `Readable`/`Writable` declarations out of
 * `@implementjs/core` rather than paraphrasing them, which only helps for as
 * long as the quote is accurate. Copies of source in prose are exactly what
 * went stale in the agent skills, so this one is pinned to the source.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

function read(...segments: string[]): string {
	return fs.readFileSync(path.join(here, "..", ...segments), "utf8");
}

/** The two interface declarations, from `export interface Readable` up to the guards below them. */
function declarations(source: string): string {
	const start = source.indexOf("export interface Readable<T> {");
	const end = source.indexOf("export function isReadable");
	if (start === -1 || end === -1) {
		throw new Error("signal.ts no longer declares Readable/Writable where this test expects them");
	}
	return source.slice(start, end).trim();
}

it("quotes the signal interfaces exactly as core declares them", () => {
	const source = read("..", "..", "packages", "core", "src", "signal.ts");

	expect(read("src", "content", "signals.md")).toContain(declarations(source));
});
