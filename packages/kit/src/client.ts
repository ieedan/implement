/**
 * The typed API client kit generates for an app's `server.ts` endpoints.
 *
 * ```ts
 * import { api } from "$implement/client";
 *
 * const { data, error } = await api.GET("/api/posts/[id]", { params: { id: "1" } });
 * ```
 *
 * The route table (`.implement/client.ts`) is generated from the route tree
 * alone: each entry names a route key and reads that route's methods off the
 * module's *type* through {@link Operations}, so nothing here evaluates a
 * `server.ts` — `typeof import(...)` is erased before the bundle exists.
 *
 * Browser-safe and dependency-free. The `neverthrow` variant lives in its own
 * entry (`@implementjs/kit/client/neverthrow`) so this one never pulls a
 * runtime dependency in.
 */

import type { EndpointSpec, Method, SPEC } from "./endpoint.ts";

export type { Method } from "./endpoint.ts";

/** Every method a `server.ts` may export, in the order `Allow` lists them. */
const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

// ---------------------------------------------------------------------------
// The route table
// ---------------------------------------------------------------------------

/** One route of the generated table: its params, and the operations it serves. */
export type ApiRoute = {
	/** The params the route key binds, as the URL carries them. */
	params: Record<string, string>;
	operations: Partial<Record<Method, EndpointSpec>>;
};

/**
 * The generated table: route key → route. Keys are `routeId(pattern)` with any
 * extension appended — `/api/posts/[id]`, `/docs/[...slug].md` — which is the
 * URL with its params still in place.
 */
export type ApiRoutes = Record<string, ApiRoute>;

/** What a plain, unwrapped `RequestHandler` offers: nothing to send, nothing known to come back. */
export type PlainSpec = { params: unknown; query: undefined; body: undefined; data: unknown };

/**
 * The operations a `server.ts` module exports, read off its type. Which
 * methods a file exports never has to be known at generation time — this maps
 * over whatever the module turns out to declare.
 */
export type Operations<M> = {
	[K in Extract<keyof M, Method>]: SpecOf<M[K]>;
};

type SpecOf<H> = H extends { [SPEC]: infer S extends EndpointSpec } ? S : PlainSpec;

// ---------------------------------------------------------------------------
// How a call's outcome reaches the caller
// ---------------------------------------------------------------------------

/** What a call returns in the default `"result"` style. */
export type Outcome<Data> =
	| { data: Data; error: undefined; response: Response }
	| { data: undefined; error: ApiError; response: Response | undefined };

/**
 * The type-level hole a call's return shape is plugged into, so one client
 * type serves every error style. `out` is written in terms of `this["data"]`,
 * and {@link Apply} fills that in per call.
 */
export interface Wrapper {
	readonly data: unknown;
	readonly out: unknown;
}

/** One call's return type: `W`'s shape with `Data` substituted in. */
export type Apply<W extends Wrapper, Data> = (W & { readonly data: Data })["out"];

/** `{ data, error, response }` — the default. */
export interface ResultWrapper extends Wrapper {
	readonly out: Promise<Outcome<this["data"]>>;
}

/** The data, with an {@link ApiError} thrown on failure. */
export interface ThrowWrapper extends Wrapper {
	readonly out: Promise<this["data"]>;
}

// ---------------------------------------------------------------------------
// The client types
// ---------------------------------------------------------------------------

/** The operation a route serves for a method, or `never` when it serves none. */
type OperationOf<
	A extends ApiRoutes,
	K extends keyof A,
	M extends Method,
> = M extends keyof A[K]["operations"] ? NonNullable<A[K]["operations"][M]> : never;

/** The route keys that answer `M` at all — so an unsupported method is a type error. */
type KeyFor<A extends ApiRoutes, M extends Method> = {
	[K in keyof A]: M extends keyof A[K]["operations"] ? K : never;
}[keyof A];

/** `{}` by another name — a type every object type is assignable to. */
type EmptyObject = Record<never, never>;

/** A route with no params takes no `params`; one with params requires them. */
type ParamsField<P> = [keyof P] extends [never] ? { params?: undefined } : { params: P };

/**
 * An undeclared query is loosely typed and optional; a declared one is
 * required unless every field of it is.
 */
type QueryField<Q> = [Q] extends [undefined]
	? { query?: QueryInit }
	: EmptyObject extends Q
		? { query?: Q }
		: { query: Q };

/** The same for the body, with `undefined` meaning "this handler declares none". */
type BodyField<B> = [B] extends [undefined]
	? { body?: RawBody }
	: EmptyObject extends B
		? { body?: B }
		: { body: B };

/** Query values the client knows how to put in a URL. */
export type QueryValue = string | number | boolean;

/** An undeclared query: whatever the caller wants to append. */
export type QueryInit = Record<string, QueryValue | QueryValue[] | null | undefined>;

/** A body the client sends as-is rather than serializing to JSON. */
export type RawBody =
	| FormData
	| URLSearchParams
	| Blob
	| ArrayBuffer
	| ArrayBufferView<ArrayBuffer>
	| string;

/** Per-call options every operation takes, on top of its own `params`/`query`/`body`. */
export type RequestOptions = {
	headers?: HeadersInit;
	signal?: AbortSignal;
	/** Overrides the client's `fetch` for this call. */
	fetch?: typeof fetch;
	/** Merged under what the client computes — `credentials`, `cache`, `mode`, … */
	init?: Omit<RequestInit, "method" | "body" | "headers" | "signal">;
};

/** Everything one call takes. */
export type CallOptions<A extends ApiRoutes, K extends keyof A, M extends Method> = RequestOptions &
	ParamsField<A[K]["params"]> &
	QueryField<OperationOf<A, K, M>["query"]> &
	BodyField<OperationOf<A, K, M>["body"]>;

/** The options argument, optional when nothing about the call is required. */
type CallArgs<A extends ApiRoutes, K extends keyof A, M extends Method> =
	EmptyObject extends CallOptions<A, K, M>
		? [options?: CallOptions<A, K, M>]
		: [options: CallOptions<A, K, M>];

type DataOf<A extends ApiRoutes, K extends keyof A, M extends Method> = OperationOf<
	A,
	K,
	M
>["data"];

/** Method-first: `api.GET("/api/posts/[id]", { params })`. The default style. */
export type MethodClient<A extends ApiRoutes, W extends Wrapper = ResultWrapper> = {
	[M in Method]: <K extends KeyFor<A, M> & keyof A>(
		path: K,
		...options: CallArgs<A, K, M>
	) => Apply<W, DataOf<A, K, M>>;
};

/**
 * Route-first, nested by segment: `api.api.posts["[id]"].GET({ params })`.
 *
 * The tree is the route table's keys split on `/`, so it reads the way the
 * URLs do and autocompletes a segment at a time — every level offers only the
 * segments that actually continue a route, and the methods a route serves sit
 * at its leaf. A route's own methods share a level with the routes nested
 * under it, which is what `/api` and `/api/posts/[id]` both existing means, so
 * the seven method names are reserved: a segment spelled `GET` is not
 * reachable this way.
 */
export type NestedClient<A extends ApiRoutes, W extends Wrapper = ResultWrapper> = NestedAt<
	A,
	W,
	""
>;

/**
 * One level of the tree: the calls the route at `Prefix` serves, plus the
 * segments that continue it. `Prefix` is the route key built up so far, which
 * is `""` at the root — where the route key, if there is one, is `/`.
 */
type NestedAt<A extends ApiRoutes, W extends Wrapper, Prefix extends string> = CallsAt<
	A,
	W,
	Prefix extends "" ? "/" : Prefix
> & {
	[S in Segment<A, Prefix>]: NestedAt<A, W, `${Prefix}/${S}`>;
};

/** What the route keyed exactly `K` serves — nothing, when no route is keyed that. */
type CallsAt<A extends ApiRoutes, W extends Wrapper, K extends string> = K extends keyof A
	? {
			[M in Extract<keyof A[K]["operations"], Method>]: (
				...options: CallArgs<A, K, M>
			) => Apply<W, DataOf<A, K, M>>;
		}
	: EmptyObject;

/** Every segment that follows `Prefix/` in some route key, up to the next `/`. */
type Segment<A extends ApiRoutes, Prefix extends string> = {
	[K in keyof A]: K extends `${Prefix}/${infer Rest}` ? Exclude<Head<Rest>, ""> : never;
}[keyof A];

/** What is left of a key once `Prefix/` is gone, up to the next `/`: `posts/[id]` → `posts`. */
type Head<S extends string> = S extends `${infer First}/${string}` ? First : S;

/** The ready-made client `$implement/client` exports: method-first, `{ data, error }`. */
export type TypedClient<A extends ApiRoutes> = MethodClient<A>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A call that did not produce a 2xx — or did not produce a response at all.
 * `status` is `0` when the request never reached a server, so a caller can
 * treat "offline" and "rejected" the same way without a second `try`.
 */
export class ApiError extends Error {
	readonly status: number;
	/** The parsed response body, when there was one. */
	readonly body: unknown;
	readonly response: Response | undefined;

	constructor(
		status: number,
		body: unknown,
		response: Response | undefined,
		options?: ErrorOptions,
	) {
		super(errorMessage(status, body, response), options);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
		this.response = response;
	}
}

/** The app's `handleError` shape is `{ message }`, so prefer it over the status line. */
function errorMessage(status: number, body: unknown, response: Response | undefined): string {
	if (typeof body === "object" && body !== null && "message" in body) {
		const { message } = body;
		if (typeof message === "string" && message !== "") return message;
	}
	if (status === 0) return "request failed";
	const text = response?.statusText;
	return text === undefined || text === "" ? `request failed with ${status}` : `${status} ${text}`;
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

export type ClientOptions = {
	/**
	 * Prefixed to every route key. Empty by default, which is what a browser
	 * wants; on the server use `event.api`, which is bound to the in-process
	 * fetch and to the request's own origin.
	 */
	baseUrl?: string;
	/** Sent with every call — a function is called per request, for a rotating token. */
	headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
	/** What actually makes the request. @default globalThis.fetch */
	fetch?: typeof fetch;
	/** How a call's outcome reaches the caller. @default "result" */
	errors?: "result" | "throw";
	/**
	 * `"method"` for `api.GET(path, …)`, `"nested"` for the route's own segments
	 * — `api.api.posts["[id]"].GET(…)`.
	 *
	 * @default "method"
	 */
	style?: "method" | "nested";
};

/** The loosely-typed shape of one call's options, as the runtime sees it. */
export type CallInput = RequestOptions & {
	params?: Record<string, unknown>;
	query?: Record<string, unknown>;
	body?: unknown;
};

/**
 * Builds a client over a route table. Apps get one ready-made — `api` from
 * `$implement/client` — and call this only for a second one pointing somewhere
 * else.
 *
 * ```ts
 * export const admin = createClient({ baseUrl: "https://admin.example.com" });
 * ```
 *
 * The client type comes from the call site: the generated `createClient`
 * annotates its own return type, so `C` is whatever the app's table says.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- `C` is the point: the client's type comes from the call site's annotation, which is what the generated `createClient` supplies.
export function createClient<C>(options: ClientOptions = {}): C {
	const send = (method: Method, path: string, input?: CallInput) =>
		dispatch(method, path, input, options);
	if (options.style === "nested") return createNested<C>(send);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The shape is fixed; the types come from the generated table.
	return methodsFor(
		(method) => (path: string, input?: CallInput) => send(method, path, input),
	) as C;
}

/** The method names a nested level answers to rather than reading as a segment. */
const METHOD_NAMES = new Set<string>(METHODS);

/**
 * The nested tree, over whatever one call turns out to be — both client entries
 * build theirs with this, the `neverthrow` one wrapping the outcome on the way
 * out.
 *
 * There is nothing to enumerate: the route keys live only in the types, so the
 * proxy accumulates segments as they are read and dispatches on the first
 * method name it sees.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- As with `createClient`: the tree's type comes from the call site's annotation.
export function createNested<C>(
	send: (method: Method, path: string, input?: CallInput) => unknown,
	prefix = "",
): C {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The generated table is what types this; the runtime is segment accumulation either way.
	return new Proxy(
		{},
		{
			get: (_, key) => {
				if (typeof key !== "string") return undefined;
				if (!METHOD_NAMES.has(key)) return createNested(send, `${prefix}/${key}`);
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `METHOD_NAMES` is built from `METHODS`, so a hit is a `Method`.
				const method = key as Method;
				// a route at the root of the tree is keyed "/", not ""
				const path = prefix === "" ? "/" : prefix;
				return (input?: CallInput) => send(method, path, input);
			},
		},
	) as C;
}

function methodsFor<F>(build: (method: Method) => F): Record<Method, F> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Built from METHODS, so every key is present.
	return Object.fromEntries(METHODS.map((method) => [method, build(method)])) as Record<Method, F>;
}

async function dispatch(
	method: Method,
	path: string,
	input: CallInput | undefined,
	options: ClientOptions,
): Promise<unknown> {
	const outcome = await run(method, path, input, options);
	if (options.errors !== "throw") return outcome;
	if (outcome.error !== undefined) throw outcome.error;
	return outcome.data;
}

/** One request, start to finish, with every failure turned into an {@link ApiError}. */
export async function run(
	method: Method,
	path: string,
	input: CallInput | undefined,
	options: ClientOptions,
): Promise<Outcome<unknown>> {
	const url = buildUrl(path, input?.params, input?.query, options.baseUrl);
	const headers = new Headers(
		typeof options.headers === "function" ? await options.headers() : options.headers,
	);
	for (const [name, value] of new Headers(input?.headers)) headers.set(name, value);

	const init: RequestInit = { ...input?.init, method, headers, signal: input?.signal };
	if (input?.body !== undefined) {
		if (isRawBody(input.body)) {
			init.body = input.body;
		} else {
			init.body = JSON.stringify(input.body);
			if (!headers.has("content-type")) headers.set("content-type", "application/json");
		}
	}

	const call = input?.fetch ?? options.fetch ?? globalThis.fetch;
	let response: Response;
	try {
		response = await call(url, init);
	} catch (cause) {
		// no response at all — a caller checking `error` should not also need a
		// try/catch to survive being offline
		return {
			data: undefined,
			error: new ApiError(0, undefined, undefined, { cause }),
			response: undefined,
		};
	}

	let body: unknown;
	try {
		body = await readBody(response);
	} catch (cause) {
		return {
			data: undefined,
			error: new ApiError(response.status, undefined, response, { cause }),
			response,
		};
	}
	if (!response.ok) {
		return { data: undefined, error: new ApiError(response.status, body, response), response };
	}
	return { data: body, error: undefined, response };
}

const JSON_TYPE = /^application\/([\w.-]+\+)?json\b/;

async function readBody(response: Response): Promise<unknown> {
	// a 204/205/304 has no body to read, and reading one is an error in itself
	if (response.status === 204 || response.status === 205 || response.status === 304) {
		return undefined;
	}
	const type = (response.headers.get("content-type") ?? "").trim().toLowerCase();
	const text = await response.text();
	if (!JSON_TYPE.test(type)) return text;
	return text === "" ? undefined : JSON.parse(text);
}

function isRawBody(body: unknown): body is RawBody {
	return (
		typeof body === "string" ||
		body instanceof FormData ||
		body instanceof URLSearchParams ||
		body instanceof Blob ||
		body instanceof ArrayBuffer ||
		ArrayBuffer.isView(body)
	);
}

/**
 * The URL a call goes to: the route key with its params substituted in, the
 * query appended, and the client's base URL in front.
 *
 * ```
 * /docs/[...slug].md + { slug: "guide/install" } → /docs/guide/install.md
 * ```
 */
export function buildUrl(
	key: string,
	params: Record<string, unknown> | undefined,
	query: Record<string, unknown> | undefined,
	baseUrl = "",
): string {
	const path = key.replaceAll(
		/\[(\.\.\.)?([^\]]+)\]/g,
		(_, rest: string | undefined, name: string) => {
			const value = stringify(params?.[name]);
			if (value === null) throw new Error(`missing route param "${name}" for ${key}`);
			// a catch-all binds a whole path, so its slashes are separators
			return rest === undefined
				? encodeURIComponent(value)
				: value.split("/").map(encodeURIComponent).join("/");
		},
	);
	const base = baseUrl.replace(/\/+$/, "");
	return `${base}${path}${toSearch(query)}`;
}

function toSearch(query: Record<string, unknown> | undefined): string {
	if (query === undefined) return "";
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		for (const entry of Array.isArray(value) ? value : [value]) {
			const encoded = stringify(entry);
			if (encoded !== null) search.append(key, encoded);
		}
	}
	const encoded = search.toString();
	return encoded === "" ? "" : `?${encoded}`;
}

/**
 * A param or query value as the URL carries it. `null` for nothing to send;
 * anything that is not a primitive is JSON, since a URL has no other spelling
 * for it and `[object Object]` is never what the caller meant.
 */
function stringify(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}
	return JSON.stringify(value) ?? null;
}
