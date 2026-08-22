import { RuleTester } from "eslint";
import { describe, it } from "vitest";

// RuleTester reaches for a global `describe`/`it` and falls back to running
// everything inline when there isn't one. Vitest only puts those on the global
// with `globals: true`, so hand them over explicitly and keep one test per case.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/**
 * Fixtures are written as modules because every rule that resolves an import
 * needs one, and as plain JavaScript because none of these rules look at a
 * type annotation — the nodes they visit parse identically either way. The
 * `.ts` side is covered end to end by `oxlint.test.ts`.
 */
export const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});
