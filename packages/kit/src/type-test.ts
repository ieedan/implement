/**
 * Compile-time checks for the types a route reaches its caller through — what a
 * param matcher does downstream, and what `handle`'s return says `data` is.
 * Nothing here runs: `tsc --noEmit` over this file *is* the test, and a
 * `@ts-expect-error` that stops erroring fails the build like a broken
 * assertion would.
 */

import type { Operations, TypedClient } from "./client.ts";
import { json, type HandlerBuilder } from "./endpoint.ts";
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

// --- what `handle`'s return says `data` is ---------------------------------

type Issue = { id: string; title: string };
declare const issue: Issue;
declare const handle: HandlerBuilder;

/** A value returned as-is: the client sees it. */
const plain = handle({ handle: () => issue });
/** `json()` sets the status and keeps the body. */
const created = handle({ handle: () => json(issue, { status: 201 }) });
/** A plain `Response` opts out of response handling, so there is no data to promise. */
const raw = handle({ handle: () => new Response("hi") });
/** A branch each way is the union of what the branches say. */
const either = handle({ handle: (event) => (event.url.search === "" ? issue : json(issue)) });
/** A plain `Response` on one branch contributes nothing rather than erasing the other. */
const orRaw = handle({ handle: (event) => (event.url.search === "" ? issue : new Response("hi")) });

declare const asData: <M>(module: M) => Operations<{ GET: M }>["GET"]["data"];

const fromPlain: Issue = asData(plain);
const fromCreated: Issue = asData(created);
const fromEither: Issue = asData(either);
const fromOrRaw: Issue = asData(orRaw);
// a plain `Response` says nothing about the body, so there is nothing to read
const fromRaw: never = asData(raw);
// @ts-expect-error `json()` carries the issue, not a string
const dataIsNotAString: string = asData(created);

void [fromPlain, fromCreated, fromEither, fromOrRaw, fromRaw, dataIsNotAString];
