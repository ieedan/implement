/**
 * Validated, typed endpoint handlers — the wrapper a route's `./$types`
 * re-exports as `handler`.
 *
 * ```ts
 * // src/routes/api/posts/[id]/server.ts
 * import * as z from "zod";
 * import { handler } from "./$types";
 *
 * export const GET = handler({
 * 	query: z.object({ draft: z.stringbool().default(false) }),
 * 	async handle({ params, query }) {
 * 		//          ^? { id: string }    ^? { draft: boolean }
 * 		return await db.post(params.id, { draft: query.draft });
 * 	},
 * });
 * ```
 *
 * `handler()` returns a plain request handler, so nothing downstream — the
 * `405`/`Allow` computation, the prerenderer's `prerender` read, the adapters
 * — has to know it exists. Validation happens inside the returned closure, and
 * a failure throws through {@link error} so `hooks.server.ts` sees it like any
 * other `HttpError`.
 *
 * The schemas are anything implementing [Standard
 * Schema](https://standardschema.dev) — zod, valibot, arktype — the same
 * contract `defineEnv` uses. `response` is optional: declare one and the
 * result is validated and documented, omit it and the client's `data` type is
 * inferred from what `handle` returns.
 *
 * Dependency-free, like `./match.ts`: nothing here may import
 * `@implementjs/core` or `node:*`, since the generated client re-exports these
 * types into the browser bundle.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { error, formatSchemaIssues } from "./errors.ts";
import type { RequestEvent } from "./match.ts";
// type-only, so this never becomes a runtime cycle with `./server.ts`'s
// re-export of `handler`
import type { MaybePromise } from "./server.ts";

/** The HTTP methods a `server.ts` may export a handler for. */
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

/**
 * Query params as the parser produces them: one value for a key is a `string`,
 * a key that repeats is a `string[]`. This is what `event.query` holds when a
 * handler declares no `query` schema.
 */
export type QueryRecord = Record<string, string | string[]>;

/**
 * A form body flattened to an object, the same way: one value per field, an
 * array when a field repeats. Files come through as `File`.
 */
export type FormRecord = Record<string, FormDataEntryValue | FormDataEntryValue[]>;

/**
 * The type-level shape of one operation: what a caller sends and what it gets
 * back. The generated client reads this off the handler and never evaluates
 * the module.
 */
export type EndpointSpec = {
	/** What `handle` sees as `event.params` — the route's strings, or the `params` schema's output. */
	params: unknown;
	/** What a caller may send as `query`, or `undefined` when nothing declares it. */
	query: unknown;
	/** What a caller must send as `body`, or `undefined` when nothing declares it. */
	body: unknown;
	/** What the caller receives: the `response` schema's output, or `handle`'s return type. */
	data: unknown;
};

/**
 * Type-only phantom key. `handler()` never sets this property — it exists so
 * the generated client can read an operation's shape off the handler's type,
 * and reading it at runtime yields `undefined`.
 */
export const SPEC: unique symbol = Symbol.for("@implementjs/kit:endpoint-spec");

/** Runtime key: the definition `handler()` was called with, for the OpenAPI document. */
export const DEFINITION: unique symbol = Symbol.for("@implementjs/kit:endpoint-definition");

/** What `handler()` returns — a plain request handler carrying its operation's type. */
export type Handler<S extends EndpointSpec = EndpointSpec> = ((
	event: RequestEvent,
) => Promise<Response>) & {
	/** Type-only — see {@link SPEC}. Never read this at runtime. */
	readonly [SPEC]: S;
	/** The definition this handler was built from. */
	readonly [DEFINITION]: HandlerDefinition;
};

/** The event a validated `handle` receives: the request event with the parsed parts on it. */
export type HandlerEvent<Params, Query, Body> = Omit<RequestEvent, "params"> & {
	/** The route's params — strings, or the `params` schema's output when one is declared. */
	params: Params;
	/** `url.searchParams`, or the `query` schema's output when one is declared. */
	query: Query;
	/** The parsed request body, or `undefined` when no `body` schema is declared. */
	body: Body;
};

/** The definition as `handler()` holds it — every schema erased to the spec's own type. */
export type HandlerDefinition = {
	params?: StandardSchemaV1;
	query?: StandardSchemaV1;
	body?: StandardSchemaV1;
	response?: StandardSchemaV1;
	/**
	 * Whether the `response` schema also runs against what `handle` returned.
	 * Defaults to on outside production — a response that does not match its
	 * own schema is a bug, and paying for the check on every production request
	 * is not always worth catching it.
	 */
	validateResponse?: boolean;
	handle: (event: HandlerEvent<unknown, unknown, unknown>) => unknown;
};

type Schema = StandardSchemaV1;

/** `event.params`: the `params` schema's output, or the route's own strings. */
type ParamsOf<PS, Fallback> = PS extends Schema ? StandardSchemaV1.InferOutput<PS> : Fallback;

/** `event.query`: the `query` schema's output, or the raw parsed record. */
type QueryOf<QS> = QS extends Schema ? StandardSchemaV1.InferOutput<QS> : QueryRecord;

/** `event.body`: the `body` schema's output, or nothing — an undeclared body is never read. */
type BodyOf<BS> = BS extends Schema ? StandardSchemaV1.InferOutput<BS> : undefined;

/**
 * What a caller passes as `query`: the schema's *output* types, under the
 * schema's *input* optionality.
 *
 * Values come from the output because query values are strings on the wire
 * either way and un-stringifying them is exactly what the schema is for — so
 * `z.stringbool()` asks the caller for a boolean and the client serializes it.
 * Optionality comes from the input because that is what says whether a caller
 * may leave a key out: a field with a `.default()` is required in the output
 * and optional to send.
 */
type QueryInputOf<QS> = QS extends Schema
	? SendShape<StandardSchemaV1.InferInput<QS>, StandardSchemaV1.InferOutput<QS>>
	: undefined;

/** The keys of `T` a caller may leave out. */
type OptionalKeys<T> = { [K in keyof T]-?: EmptyObject extends Pick<T, K> ? K : never }[keyof T];

/** `Out`'s value types with `In`'s optionality. */
type SendShape<In, Out> = {
	[K in keyof Out as K extends OptionalKeys<In> ? K : never]?: Out[K];
} & {
	[K in keyof Out as K extends OptionalKeys<In> ? never : K]: Out[K];
};

/** `{}` by another name — a type every object type is assignable to. */
type EmptyObject = Record<never, never>;

/**
 * What a caller passes as `body`. The schema's *input*, since a JSON body
 * travels structurally and a schema that transforms receives the input shape.
 */
type BodyInputOf<BS> = BS extends Schema ? StandardSchemaV1.InferInput<BS> : undefined;

/** The parts of a definition that do not depend on whether a `response` schema is present. */
type Parts<PS, QS, BS> = {
	/** Overrides the route's string params — coerce an `[id]` to a number here. */
	params?: PS;
	/** Validates `url.searchParams`, flattened to one value (or an array) per key. */
	query?: QS;
	/** Validates the parsed request body — JSON, or a form flattened to an object. */
	body?: BS;
};

/**
 * The `handler` a route's `./$types` exports, pre-bound to that route's
 * params. Two call signatures: with a `response` schema `handle` must return
 * something the schema accepts, and without one the return type flows straight
 * through to the client.
 */
export interface HandlerBuilder<P extends Record<string, string> = Record<string, string>> {
	<
		PS extends Schema | undefined = undefined,
		QS extends Schema | undefined = undefined,
		BS extends Schema | undefined = undefined,
		RS extends Schema = Schema,
	>(
		definition: Parts<PS, QS, BS> & {
			/** Validates and documents what `handle` returns. */
			response: RS;
			/** Run the `response` schema at runtime. @default true outside production */
			validateResponse?: boolean;
			handle: (
				event: HandlerEvent<ParamsOf<PS, P>, QueryOf<QS>, BodyOf<BS>>,
			) => MaybePromise<StandardSchemaV1.InferInput<RS> | Response>;
		},
	): Handler<{
		params: ParamsOf<PS, P>;
		query: QueryInputOf<QS>;
		body: BodyInputOf<BS>;
		data: StandardSchemaV1.InferOutput<RS>;
	}>;

	<
		PS extends Schema | undefined = undefined,
		QS extends Schema | undefined = undefined,
		BS extends Schema | undefined = undefined,
		R = unknown,
	>(
		definition: Parts<PS, QS, BS> & {
			response?: undefined;
			handle: (event: HandlerEvent<ParamsOf<PS, P>, QueryOf<QS>, BodyOf<BS>>) => R;
		},
	): Handler<{
		params: ParamsOf<PS, P>;
		query: QueryInputOf<QS>;
		body: BodyInputOf<BS>;
		// returning a `Response` opts out of response handling, so it is never
		// part of what a caller receives as `data`
		data: Exclude<Awaited<R>, Response>;
	}>;
}

/**
 * Wraps a request handler in validation for its params, query, and body, and
 * turns whatever it returns into a `Response`.
 *
 * Import it from the route's `./$types` rather than from here — that copy is
 * bound to the route's own params, so `event.params` is typed without
 * repeating the pattern.
 *
 * ```ts
 * export const PATCH = handler({
 * 	params: z.object({ id: z.coerce.number() }),
 * 	body: Post.pick({ title: true }).partial(),
 * 	response: Post,
 * 	handle: ({ params, body }) => db.update(params.id, body),
 * });
 * ```
 *
 * Returning a `Response` is always allowed and skips response handling;
 * anything else is JSON-serialized, and `undefined` becomes a `204`.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The overloads are the contract; the implementation only ever sees the erased definition.
export const handler = ((definition: HandlerDefinition) =>
	buildHandler(definition)) as HandlerBuilder;

function buildHandler(definition: HandlerDefinition): Handler {
	const run = async (event: RequestEvent): Promise<Response> => {
		const params =
			definition.params === undefined
				? event.params
				: await validate(definition.params, event.params, "params");
		const query =
			definition.query === undefined
				? parseQuery(event.url)
				: await validate(definition.query, parseQuery(event.url), "query");
		const body =
			definition.body === undefined
				? undefined
				: await validate(definition.body, await readBody(event.request), "body");

		const result = await definition.handle({ ...event, params, query, body });
		if (result instanceof Response) return result;
		if (definition.response !== undefined && shouldValidateResponse(definition)) {
			await validateResponse(definition.response, result);
		}
		// `Response.json(undefined)` throws, and a handler that returned nothing
		// has nothing to send
		if (result === undefined) return new Response(null, { status: 204 });
		return Response.json(result);
	};
	Object.defineProperty(run, DEFINITION, { value: definition, enumerable: false });
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SPEC is a type-only phantom key; the runtime object carries only DEFINITION.
	return run as Handler;
}

/** The definition behind a handler, or `null` for a plain unwrapped one. */
export function handlerDefinition(value: unknown): HandlerDefinition | null {
	if (typeof value !== "function") return null;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The DEFINITION key is only ever set by buildHandler, to a HandlerDefinition.
	const definition = (value as unknown as Record<symbol, unknown>)[DEFINITION] as
		| HandlerDefinition
		| undefined;
	return definition ?? null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** `?a=1&a=2&b=3` → `{ a: ["1", "2"], b: "3" }`. */
export function parseQuery(url: URL): QueryRecord {
	const query: QueryRecord = {};
	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key);
		query[key] = values.length === 1 ? values[0]! : values;
	}
	return query;
}

/** A form body as an object, one value per field and an array where a field repeats. */
export function parseForm(form: FormData): FormRecord {
	const body: FormRecord = {};
	for (const key of new Set(form.keys())) {
		const values = form.getAll(key);
		body[key] = values.length === 1 ? values[0]! : values;
	}
	return body;
}

const JSON_TYPE = /^application\/([\w.-]+\+)?json\b/;
const FORM_TYPE = /^(multipart\/form-data|application\/x-www-form-urlencoded)\b/;

/**
 * The request body as the `body` schema will see it: JSON parsed, a form
 * flattened to an object, and anything else handed over as text — with a
 * bodyless request becoming `undefined` so the schema decides whether that is
 * allowed.
 */
async function readBody(request: Request): Promise<unknown> {
	const type = (request.headers.get("content-type") ?? "").trim().toLowerCase();
	if (FORM_TYPE.test(type)) return parseForm(await request.formData());
	const text = await request.text();
	if (text === "") return undefined;
	if (JSON_TYPE.test(type)) {
		try {
			return JSON.parse(text);
		} catch {
			error(400, "body is not valid JSON");
		}
	}
	// no content type at all is what a hand-rolled `fetch` sends most often, so
	// try JSON before giving up and passing the text through
	if (type === "") {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
	return text;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Runs a schema, answering a rejection with a `400` carrying every issue. */
async function validate(schema: Schema, value: unknown, part: string): Promise<unknown> {
	const result = await schema["~standard"].validate(value);
	if (result.issues !== undefined) {
		error(400, `invalid ${part} — ${formatSchemaIssues(result.issues)}`);
	}
	return result.value;
}

/**
 * The same check for what `handle` returned. A response that does not match
 * its own schema is the app's bug, not the caller's, so it is a `500` rather
 * than a `400` — and it goes through `handleError` like any other.
 */
async function validateResponse(schema: Schema, value: unknown): Promise<void> {
	const result = await schema["~standard"].validate(value);
	if (result.issues !== undefined) {
		throw new Error(
			`handler returned a value its response schema rejects — ${formatSchemaIssues(result.issues)}`,
		);
	}
}

function shouldValidateResponse(definition: HandlerDefinition): boolean {
	if (definition.validateResponse !== undefined) return definition.validateResponse;
	return !isProduction();
}

/** `NODE_ENV`, where there is a `process` to read it from — a worker has none. */
function isProduction(): boolean {
	const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
		?.env;
	return env?.["NODE_ENV"] === "production";
}
