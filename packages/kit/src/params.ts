/**
 * Route param matchers — what `[id=integer]` means.
 *
 * A matcher lives in `src/params/<name>.ts` and default-exports a
 * {@link matcher}, built from a [Standard Schema](https://standardschema.dev).
 * A `[param=<name>]` or `[...rest=<name>]` directory runs it over the segment
 * before the route is allowed to match, so a path the matcher rejects falls
 * through to the next route and ends up at the error page rather than in a
 * handler that has to check for itself.
 *
 * ```ts
 * // src/params/integer.ts
 * import { matcher } from "@implementjs/kit/params";
 * import * as v from "valibot";
 *
 * export default matcher(v.pipe(v.string(), v.regex(/^\d+$/)));
 * ```
 *
 * Gating the route is SvelteKit's feature. What kit adds is the other half: a
 * matcher may *parse* the segment rather than only accept it, and the type it
 * produces is the type the param has everywhere downstream — `event.params` in
 * a load or a `server.ts` handler, `params` in a page or layout, the generated
 * client.
 *
 * ```ts
 * // src/params/integer.ts
 * export default matcher(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number)));
 * ```
 *
 * ```ts
 * // src/routes/posts/[id=integer]/server.ts
 * export const GET = handler({
 * 	handle: ({ params }) => db.post(params.id),
 * 	//                             ^? number
 * });
 * ```
 *
 * Nothing here reaches the network or the filesystem, and matching happens on
 * both sides of a navigation — so, like `./match.ts` and `./endpoint.ts`, this
 * module is dependency-free: no `@implementjs/core`, no `node:*`.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * What a matcher returns for a segment it does not serve. The route does not
 * match, and matching carries on with the next one.
 *
 * A well-known symbol, and deliberately the same one `@implementjs/router`
 * exports: the router does the client-side matching and cannot depend on kit,
 * so the two meet at the symbol registry rather than at an import.
 */
export const mismatch: unique symbol = Symbol.for("implementjs:param-mismatch");

export type Mismatch = typeof mismatch;

/** Brand key, so a plain `{ match }` object cannot pass for a matcher by accident. */
const MATCHER: unique symbol = Symbol.for("implementjs:param-matcher");

/**
 * A route param matcher: the gate a `[param=<name>]` segment passes through,
 * and the type the param has once it has.
 */
export type ParamMatcher<T = string> = {
	readonly [MATCHER]: true;
	/** The value this segment carries, or {@link mismatch} when the route does not serve it. */
	readonly match: (value: string) => T | Mismatch;
	/**
	 * The schema this matcher was built from — which is what gates the segment,
	 * what types the param, and what kit converts into the OpenAPI document's
	 * parameter. One object, so the three can never disagree.
	 */
	readonly schema: StandardSchemaV1;
};

/** A matcher of any output type — what a table of them holds. */
export type AnyParamMatcher = ParamMatcher<unknown>;

/** The app's matchers, keyed by the name a `[param=<name>]` directory uses. */
export type ParamMatchers = Record<string, AnyParamMatcher>;

/**
 * What a matcher makes of a segment. This is the type kit's generated `$types`
 * give a param, read straight off the matcher module — which is why a matcher
 * never has to declare its type twice.
 */
export type ParamType<M> = M extends ParamMatcher<infer T> ? T : string;

/**
 * Builds a route param matcher from a [Standard Schema](https://standardschema.dev)
 * — the same contract `handler()` and `defineEnv` take.
 *
 * ```ts
 * matcher(v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/))); // ParamMatcher<string>
 * matcher(v.picklist(["en", "fr"]));                    // ParamMatcher<"en" | "fr">
 * matcher(z.coerce.number().int());                     // ParamMatcher<number>
 * ```
 *
 * The schema has to validate synchronously — a route match cannot be awaited.
 *
 * A schema is the only form, because it is the only one that survives leaving
 * TypeScript. A pattern or a parse function says what it produces in types and
 * nowhere else, so a build writing the OpenAPI document could only call the
 * param a string — and a `[id=integer]` route would be typed `number`
 * everywhere in the app while its own document said otherwise, with nothing to
 * say the two disagree. One schema answers all three questions at once.
 *
 * Anchor the pattern yourself. A schema's regex is the schema's own and kit
 * does not rewrite it, so `v.regex(/\d+/)` accepts `12abc` where
 * `v.regex(/^\d+$/)` does not.
 */
export function matcher<S extends StandardSchemaV1>(
	schema: S,
): ParamMatcher<StandardSchemaV1.InferOutput<S>> {
	return {
		[MATCHER]: true,
		match: (value) => {
			const result = schema["~standard"].validate(value);
			if (result instanceof Promise) {
				throw new Error(
					"a param matcher's schema has to validate synchronously — a route match cannot be awaited",
				);
			}
			return result.issues === undefined ? result.value : mismatch;
		},
		// the schema that just gated the segment is the schema kit documents the
		// param from, so there is no second declaration to drift from it
		schema,
	};
}

/** Whether a value came out of {@link matcher}. */
export function isParamMatcher(value: unknown): value is AnyParamMatcher {
	return (
		typeof value === "object" &&
		value !== null &&
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading a brand key off an unknown object is the check itself.
		(value as Record<symbol, unknown>)[MATCHER] === true
	);
}

/**
 * Checks the matcher table the generated `$implement/params` module builds —
 * every `src/params/*.ts` in the app, keyed by its filename. A module that
 * default-exports something else says so here, naming the file, rather than
 * failing later as a route that quietly never matches.
 */
export function matcherTable(table: Record<string, unknown>, dir: string): ParamMatchers {
	const matchers: ParamMatchers = {};
	for (const [name, value] of Object.entries(table)) {
		if (!isParamMatcher(value)) {
			throw new Error(
				`${dir}/${name}.ts must default-export a matcher() — got ${value === null ? "null" : typeof value}`,
			);
		}
		matchers[name] = value;
	}
	return matchers;
}

// ---------------------------------------------------------------------------
// The app's matchers
// ---------------------------------------------------------------------------

let registered: ParamMatchers = {};

/**
 * Publishes the app's matchers to the paths that resolve a route without being
 * handed one — the client's chunk preloader and its route-data fetch. The
 * generated `$implement/router` module calls this as it loads, alongside
 * `registerRoutes`, so both graphs have them before the first match.
 */
export function registerMatchers(matchers: ParamMatchers): void {
	registered = matchers;
}

/** The matchers {@link registerMatchers} published, empty until it has run. */
export function appMatchers(): ParamMatchers {
	return registered;
}
