/**
 * Route param matchers — what `[id=integer]` means.
 *
 * A matcher lives in `src/params/<name>.ts` and default-exports a
 * {@link matcher}. A `[param=<name>]` or `[...rest=<name>]` directory runs it
 * over the segment before the route is allowed to match, so a path the matcher
 * rejects falls through to the next route and ends up at the error page rather
 * than in a handler that has to check for itself.
 *
 * ```ts
 * // src/params/integer.ts
 * import { matcher } from "@implementjs/kit/params";
 *
 * export default matcher(/\d+/);
 * ```
 *
 * That much is SvelteKit's feature. What kit adds is the other half: a matcher
 * may *parse* the segment rather than only accept it, and the type it produces
 * is the type the param has everywhere downstream — `event.params` in a load or
 * a `server.ts` handler, `params` in a page or layout, the generated client.
 *
 * ```ts
 * // src/params/integer.ts
 * import { matcher, mismatch } from "@implementjs/kit/params";
 *
 * export default matcher((value) => {
 * 	const parsed = Number(value);
 * 	return Number.isInteger(parsed) ? parsed : mismatch;
 * });
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
	 * The schema this matcher was built from, when it was built from one —
	 * which is both what gates the segment and what it produces, so it is the
	 * matcher describing itself rather than being told twice. `null` for a
	 * pattern or a parse function, which say what they produce in TypeScript
	 * and nowhere a runtime can read.
	 *
	 * Kit reads it where something needs the param's type and has no types to
	 * read it from: the OpenAPI document, whose path parameters would otherwise
	 * describe a `[id=integer]` route's `id` as the string it arrived as.
	 */
	readonly schema: StandardSchemaV1 | null;
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

type Parse<T> = (value: string) => T | Mismatch;

/**
 * Builds a route param matcher from a pattern, a parse function, or a
 * [Standard Schema](https://standardschema.dev).
 *
 * ```ts
 * matcher(/[a-z0-9-]+/);                       // ParamMatcher<string>
 * matcher((v) => (v === "en" ? v : mismatch)); // ParamMatcher<"en">
 * matcher(z.coerce.number().int());            // ParamMatcher<number>
 * ```
 *
 * A pattern has to match the whole segment — kit anchors it, so `/\d+/` means
 * "digits and nothing else" rather than "digits somewhere in there".
 *
 * The schema form is the one that carries its type past TypeScript. A pattern
 * or a parse function says what it produces in TypeScript, which is where
 * `$types` reads it — but the OpenAPI document is written by a build, with no
 * types to read, so it can only describe such a param as the string it arrived
 * as. Built from a schema, one declaration gates the segment, types the param,
 * and documents it, and none of the three can drift from the others.
 */
export function matcher(pattern: RegExp): ParamMatcher;
export function matcher<T>(parse: Parse<T>): ParamMatcher<Exclude<T, Mismatch>>;
export function matcher<S extends StandardSchemaV1>(
	schema: S,
): ParamMatcher<StandardSchemaV1.InferOutput<S>>;
export function matcher(source: RegExp | Parse<unknown> | StandardSchemaV1): AnyParamMatcher {
	if (source instanceof RegExp) {
		const anchored = wholeSegment(source);
		return define((value) => (anchored.test(value) ? value : mismatch), null);
	}
	if (typeof source === "function") return define(source, null);
	return define((value) => {
		const result = source["~standard"].validate(value);
		if (result instanceof Promise) {
			throw new Error(
				"a param matcher's schema has to validate synchronously — a route match cannot be awaited",
			);
		}
		return result.issues === undefined ? result.value : mismatch;
		// the schema the matcher was built from is also what it produces, so it
		// describes itself without being told twice
	}, source);
}

function define<T>(match: Parse<T>, schema: StandardSchemaV1 | null): ParamMatcher<T> {
	return { [MATCHER]: true, match, schema };
}

/**
 * The pattern, anchored to the whole segment and stripped of the stateful
 * flags — `g` and `y` carry a `lastIndex` between calls, which would make a
 * matcher answer differently on every other request.
 */
function wholeSegment(pattern: RegExp): RegExp {
	return new RegExp(`^(?:${pattern.source})$`, pattern.flags.replaceAll(/[gy]/g, ""));
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
