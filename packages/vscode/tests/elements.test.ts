import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readElements, readVoidElements, render } from "../scripts/sync-elements.mts";
import { ELEMENTS, VOID_ELEMENTS } from "../src/elements.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("src/elements.ts", () => {
	// A stale table makes confidently wrong suggestions — children on a tag that
	// takes none, or nothing at all on a tag core just added. `pnpm generate`
	// fixes a failure here.
	it("is in sync with @implementjs/core", () => {
		const generated = render(readElements(), readVoidElements());
		const onDisk = readFileSync(join(here, "../src/elements.ts"), "utf8");
		expect(onDisk).toBe(generated);
	});

	it("covers every void element", () => {
		for (const name of VOID_ELEMENTS) {
			expect(ELEMENTS).toContain(name);
		}
	});
});
