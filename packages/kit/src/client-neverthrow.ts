/**
 * The `neverthrow` flavour of the generated client, at
 * `@implementjs/kit/client/neverthrow`.
 *
 * ```ts
 * api.GET("/api/posts/[id]", { params: { id: "1" } }).match(render, handleError);
 * ```
 *
 * A call returns a `ResultAsync<Data, ApiError>`, which is already a
 * `PromiseLike` — `.map`, `.andThen`, and `.match` chain straight off the call,
 * and `await` is only for when the plain `Result` is what you want.
 *
 * This is the one error style with a runtime dependency, which is why it is an
 * entry of its own: `neverthrow` is an optional peer, imported statically here
 * and nowhere else, so an app that never selects this style never installs it
 * and the other two entries stay dependency-free.
 */

import { err, ok, ResultAsync } from "neverthrow";
import {
	ApiError,
	createClient as createResultClient,
	createNested,
	type ApiRoutes,
	type CallInput,
	type ClientOptions,
	type Method,
	type MethodClient,
	type NestedClient,
	type Outcome,
	type Wrapper,
} from "./client.ts";

export type {
	ApiRoute,
	ApiRoutes,
	ClientOptions,
	Method,
	Operations,
	Outcome,
	PlainSpec,
	RequestOptions,
} from "./client.ts";
export { ApiError, buildUrl } from "./client.ts";

/** A call's return shape in this style. */
export interface NeverthrowWrapper extends Wrapper {
	readonly out: ResultAsync<this["data"], ApiError>;
}

/** Method-first (`api.GET(path, …)`), returning a `ResultAsync`. */
export type ResultClient<A extends ApiRoutes> = MethodClient<A, NeverthrowWrapper>;

/** Nested by segment (`api.api.posts["[id]"].GET(…)`), returning a `ResultAsync`. */
export type ResultNestedClient<A extends ApiRoutes> = NestedClient<A, NeverthrowWrapper>;

/** The loosely-typed shape every call has once the generated types are erased. */
type Call = (...args: unknown[]) => Promise<Outcome<unknown>>;

/**
 * The same client as `@implementjs/kit/client`, with every call wrapped in a
 * `ResultAsync`. `errors` is fixed by the entry you imported, so it is not an
 * option here.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- As in `./client.ts`: the client's type comes from the call site.
export function createClient<C>(options: Omit<ClientOptions, "errors"> = {}): C {
	const client = createResultClient<Record<Method, (path: string, input?: CallInput) => unknown>>({
		...options,
		errors: "result",
		nested: false,
	});
	// the nested tree hands back a fresh call per leaf, so the wrap has to
	// happen on the way out of the proxy rather than once up front
	if (options.nested === true) {
		return createNested<C>((method, path, input) =>
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `createClient` above is the method client, so every call answers with an `Outcome`.
			wrap(client[method](path, input) as Promise<Outcome<unknown>>),
		);
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Same.
	return wrapAll(client) as C;
}

/** Every method of one client object, wrapped. */
function wrapAll(source: unknown): Record<string, unknown> {
	const wrapped: Record<string, unknown> = {};
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Every client object is a record of method name → call; the generated types are what narrow it.
	for (const [method, call] of Object.entries(source as Record<string, Call>)) {
		wrapped[method] = (...args: unknown[]) => wrap(call(...args));
	}
	return wrapped;
}

/**
 * `run` never rejects — a network failure comes back as an `ApiError` with
 * status `0` — so `fromSafePromise` is the honest constructor here.
 */
function wrap(outcome: Promise<Outcome<unknown>>): ResultAsync<unknown, ApiError> {
	return ResultAsync.fromSafePromise(outcome).andThen((result) =>
		result.error === undefined ? ok(result.data) : err(result.error),
	);
}
