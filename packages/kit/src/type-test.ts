/**
 * Compile-time checks for what a route param matcher does to the types
 * downstream. Nothing here runs — `tsc --noEmit` over this file *is* the test,
 * and a `@ts-expect-error` that stops erroring fails the build like a broken
 * assertion would.
 */

import type { TypedClient } from "./client.ts";
import type { HandlerBuilder } from "./endpoint.ts";
import { matcher, mismatch, type ParamType } from "./params.ts";

const integer = matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});

const locale = matcher((value) => (value === "en" || value === "fr" ? value : mismatch));

const word = matcher(/[a-z]+/);

// --- what a matcher says its param is -------------------------------------

type Integer = ParamType<typeof integer>;
type Locale = ParamType<typeof locale>;
type Word = ParamType<typeof word>;

const asNumber: Integer = 42;
// a parse narrows to exactly what its branches return, mismatch excluded
const asLocale: Locale = "fr";
const asString: Word = "abc";
// @ts-expect-error the integer matcher parses, so its param is not a string
const notAString: Integer = "42";
// @ts-expect-error "de" is not one of the two the locale matcher accepts
const notALocale: Locale = "de";
// an unmatched param — the fallback — is just a string
const unmatched: ParamType<undefined> = "anything";

void [asNumber, asLocale, asString, notAString, notALocale, unmatched];

// --- what a handler receives ----------------------------------------------

/** What a `[id=integer]` route's generated `./$types` exports. */
declare const handler: HandlerBuilder<{ id: Integer }>;

handler({
	handle: ({ params }) => ({ next: params.id + 1 }),
});

handler({
	// @ts-expect-error the matcher already parsed it; there is no string here
	handle: ({ params }) => ({ shout: params.id.toUpperCase() }),
});

// --- what the generated client asks a caller for ---------------------------

type Api = {
	"/orders/[id=integer]": {
		params: { id: Integer };
		operations: { GET: { params: { id: Integer }; query: undefined; body: undefined; data: null } };
	};
};

declare const api: TypedClient<Api>;

void api.GET("/orders/[id=integer]", { params: { id: 7 } });
// @ts-expect-error the key binds a number, so a string is not a param for it
void api.GET("/orders/[id=integer]", { params: { id: "7" } });
