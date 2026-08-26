/**
 * Compile-time checks for the types a route reaches its caller through — what a
 * param matcher does downstream, and what `handle`'s return says `data` is.
 * Nothing here runs: `tsc --noEmit` over this file *is* the test, and a
 * `@ts-expect-error` that stops erroring fails the build like a broken
 * assertion would.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as v from "valibot";
import type { Operations, TypedClient } from "./client.ts";
import { json, type HandlerBuilder } from "./endpoint.ts";
import type { LoadEvent, RequestEvent } from "./match.ts";
import { matcher, type ParamType } from "./params.ts";

const integer = matcher(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number)));

const locale = matcher(v.picklist(["en", "fr"]));

const word = matcher(v.pipe(v.string(), v.regex(/^[a-z]+$/)));

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

// --- what a `params` schema does to the route's other params ---------------

/** What a `[slug]/issues/[number]/[tab]` route's generated `./$types` exports. */
declare const wide: HandlerBuilder<{ slug: string; number: string; tab: string }>;

/** A schema for one of those three params, the way an app would coerce `[number]`. */
declare const numeric: StandardSchemaV1<{ number: string }, { number: number }>;

wide({
	params: numeric,
	// the schema's param is the schema's; the two it says nothing about are still
	// the strings the route bound
	handle: ({ params }) => `${params.slug}#${params.number + 1}${params.tab.toUpperCase()}`,
});

wide({
	params: numeric,
	// @ts-expect-error the schema declared it, so `number` is not a string here
	handle: ({ params }) => params.number.toUpperCase(),
});

wide({
	params: numeric,
	// @ts-expect-error merging the two does not invent a param the route never bound
	handle: ({ params }) => params.missing,
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

// --- what a load's parent() hands it ---------------------------------------

type Workspace = { id: string; name: string };

/** What a `[slug]/issues` page's generated `./$types` binds `LoadEvent` to. */
declare const pageLoad: LoadEvent<{ slug: string }, { workspace: Workspace }>;

/** A load at the root of its chain: nothing above it to read. */
declare const rootLoad: LoadEvent;

async function parentTypes() {
	const { workspace } = await pageLoad.parent();
	// what the layout returned, at the type the layout returned it
	const id: string = workspace.id;
	// @ts-expect-error the layout above this page returned a workspace, not a user
	void (await pageLoad.parent()).user;
	// an unbound chain says only that it is a record, not what is in it
	const anything: unknown = (await rootLoad.parent())["whatever"];
	return [id, anything];
}

void parentTypes;

/** An endpoint has no load chain above it, so nothing to await. */
declare const handlerEvent: RequestEvent;

// @ts-expect-error `parent` is a load's, not every request event's
void handlerEvent.parent;

// --- what `event.cookies` accepts and hands back ---------------------------

/** A cookie the request may not carry is a value the caller has to check. */
const session: string | undefined = handlerEvent.cookies.get("session");
// @ts-expect-error a cookie that may not be there is not a string
const alwaysThere: string = handlerEvent.cookies.get("session");

handlerEvent.cookies.set("theme", "dark", { maxAge: 60, sameSite: "strict" });
// @ts-expect-error `sameSite` is the three the header allows, not any string
handlerEvent.cookies.set("theme", "dark", { sameSite: "loose" });
// a delete takes only what identifies the cookie — the rest would change nothing
handlerEvent.cookies.delete("theme", { path: "/app", domain: "example.com" });
// @ts-expect-error `httpOnly` says nothing about which cookie is being deleted
handlerEvent.cookies.delete("theme", { httpOnly: true });

void [session, alwaysThere];

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
