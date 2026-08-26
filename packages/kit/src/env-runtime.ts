/**
 * The half of the env feature that runs where the app runs.
 *
 * `./env.ts` is the plugin's half — it bundles an env file with esbuild,
 * evaluates it in Node and re-emits it as literals, and none of that can ship.
 * Everything here is plain string and schema work with no node builtins, no
 * vite and no esbuild, because `env.dynamic.server.ts` is the one env file that
 * is *not* replaced at build time: its import of `@implementjs/kit/env`
 * survives into the server bundle, and a worker upload has no room for a build
 * tool.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { formatSchemaIssues } from "./errors.ts";

/** The prefix every key in the public env file must carry, and the private files must not. */
export const PUBLIC_PREFIX = "PUBLIC_";

/** Which of the env files a set of schemas came from. */
export type EnvKind = "public" | "server" | "dynamic" | "dynamic-public";

/** One env file, as the error messages refer to it — paths relative to the app root. */
export type EnvFileInfo = {
	kind: EnvKind;
	/** The file being evaluated, relative to the app root. */
	file: string;
	/**
	 * The other file, named in prefix errors as the place a key belongs
	 * instead. Empty for a dynamic file, which is validated at runtime and has
	 * no build-time view of what the app called its public file.
	 */
	counterpart: string;
};

export type EnvSchemas = Record<string, StandardSchemaV1>;

/** The object `defineEnv` hands back: every key, validated and typed by its schema's output. */
export type Env<T extends EnvSchemas> = {
	[K in keyof T]: StandardSchemaV1.InferOutput<T[K]>;
};

/**
 * The raw values and the file identity an evaluation runs against, published on
 * `globalThis` so the copy of `defineEnv` inside the evaluated bundle — a
 * different module instance, or the generated shim — reaches the same
 * implementation.
 */
export type EnvContext = {
	values: Record<string, string | undefined>;
	info: EnvFileInfo;
	defineEnv: (schemas: EnvSchemas) => Record<string, unknown>;
};

const CONTEXT_KEY = Symbol.for("@implementjs/kit:env-context");

type ContextHolder = { [CONTEXT_KEY]?: EnvContext };

/**
 * Declares an app's environment variables and returns them validated.
 *
 * Each key maps to a [Standard Schema](https://standardschema.dev) — valibot,
 * arktype, zod, anything implementing the spec — and the returned object is
 * typed by each schema's output, so `typeof env` flows straight into every
 * module that imports it. No code generation is involved.
 *
 * ```ts
 * // src/lib/env.public.ts
 * import { defineEnv } from "@implementjs/kit";
 * import * as v from "valibot";
 *
 * export const env = defineEnv({ PUBLIC_DOCS_URL: v.pipe(v.string(), v.url()) });
 * ```
 *
 * Under the kit plugin both env files are evaluated in Node at build time and
 * re-emitted as literals, so neither the schemas nor the schema library reach a
 * bundle — and the client copy of `env.server.ts` holds no values at all. Run
 * untransformed (plain `node`, `vitest`) the same call validates against
 * `process.env` instead, which keeps the files honest and unit-testable.
 *
 * Every key in `env.public.ts` must start with `PUBLIC_`, and no key in
 * `env.server.ts` may — a fixed rule, enforced when kit evaluates the file.
 *
 * For a value the running server picks up rather than one baked into the build,
 * see {@link defineDynamicEnv}.
 */
export function defineEnv<T extends EnvSchemas>(schemas: T): Env<T> {
	// oxlint-disable typescript/no-unsafe-type-assertion -- The evaluation context lives on globalThis, and each key's output type is the schema's, which only the mapped type expresses.
	const context = (globalThis as ContextHolder)[CONTEXT_KEY];
	if (context !== undefined) return context.defineEnv(schemas) as Env<T>;
	return validateEnv(schemas, processEnv() ?? {}, null) as Env<T>;
	// oxlint-enable typescript/no-unsafe-type-assertion
}

/**
 * `process.env` where there is a `process`, and `undefined` where there is not.
 *
 * Reached through `globalThis` rather than by naming `process`, because this is
 * the one env module an app's own `tsc` compiles — `env.dynamic.public.ts`
 * imports it — and an app is not obliged to have node's types. It is also
 * simply true in a worker, which has no `process` at all.
 */
function processEnv(): Record<string, string | undefined> | undefined {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Naming the global's shape here is what lets this module compile without node's types.
	return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
}

/**
 * Validates `schemas` against `values`, reporting every failure at once.
 * `info` scopes the `PUBLIC_` prefix rules to a file; passing `null` — the
 * untransformed `process.env` path, which has no file to attribute a key to —
 * runs the schemas only.
 *
 * @throws {Error} on a misplaced prefix, or on any key whose schema rejects.
 */
export function validateEnv(
	schemas: EnvSchemas,
	values: Record<string, string | undefined>,
	info: EnvFileInfo | null,
): Record<string, unknown> {
	const keys = Object.keys(schemas);
	if (info !== null) assertPrefixes(keys, info);

	const where = info?.file ?? "defineEnv";
	const result: Record<string, unknown> = {};
	const failures: string[] = [];
	for (const key of keys) {
		const value = values[key];
		const validated = schemas[key]!["~standard"].validate(value);
		if (validated instanceof Promise) {
			throw new Error(
				`${where}: the schema for "${key}" validates asynchronously, which kit cannot do. Use a synchronous schema.`,
			);
		}
		if (validated.issues === undefined) {
			result[key] = validated.value;
			continue;
		}
		failures.push(
			`${key} - ${value === undefined ? "not set" : formatSchemaIssues(validated.issues)}`,
		);
	}

	if (failures.length > 0) {
		const count = failures.length === 1 ? "1 variable" : `${failures.length} variables`;
		throw new Error(
			`${where}: ${count} failed validation.\n\n${failures.map((line) => `  ${line}`).join("\n")}\n\n` +
				`Set them in a .env file or in the environment.`,
		);
	}
	return result;
}

/**
 * The safety net the type system was never going to provide: a key's prefix,
 * not the file it happens to sit in, decides whether it may ship to a browser.
 */
export function assertPrefixes(keys: string[], info: EnvFileInfo): void {
	// a file checked while the app runs has no build-time view of what the app
	// called its other env files, so it names them by role instead
	if (info.kind === "public" || info.kind === "dynamic-public") {
		const unprefixed = keys.filter((key) => !key.startsWith(PUBLIC_PREFIX));
		if (unprefixed.length === 0) return;
		const counterpart = info.counterpart === "" ? "a server env file" : info.counterpart;
		throw new Error(
			`${info.file}: ${list(unprefixed)} must start with ${PUBLIC_PREFIX}.\n\n` +
				`Every variable in this file is shipped to the browser. ` +
				`Move ${unprefixed.length === 1 ? "it" : "them"} to ${counterpart}, or add the ${PUBLIC_PREFIX} prefix if the value is safe to expose.`,
		);
	}
	const prefixed = keys.filter((key) => key.startsWith(PUBLIC_PREFIX));
	if (prefixed.length === 0) return;
	const counterpart = info.counterpart === "" ? "the public env files" : info.counterpart;
	throw new Error(
		`${info.file}: ${list(prefixed)} must not start with ${PUBLIC_PREFIX}.\n\n` +
			`${PUBLIC_PREFIX} is reserved for ${counterpart}, whose values ship to the browser. ` +
			`Move ${prefixed.length === 1 ? "it" : "them"} there, or drop the prefix.`,
	);
}

function list(keys: string[]): string {
	const quoted = keys.map((key) => `"${key}"`);
	if (quoted.length === 1) return quoted[0]!;
	return `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

// ---------------------------------------------------------------------------
// The dynamic half
// ---------------------------------------------------------------------------

/**
 * Where {@link defineDynamicEnv} reads from, published on `globalThis` so the
 * plugin, the prerender and the app's own bundle all reach one slot no matter
 * how many copies of kit are loaded — the same reason the evaluation context
 * lives there.
 */
const SOURCE_KEY = Symbol.for("@implementjs/kit:dynamic-env-source");

type SourceHolder = { [SOURCE_KEY]?: Record<string, string | undefined> };

/**
 * Points {@link defineDynamicEnv} at the environment this process should read.
 *
 * Kit calls this itself in dev and while prerendering, with the values Vite
 * resolved from `.env`. In production the fallback is `process.env`, which is
 * the right answer on Node and on Vercel and needs no adapter at all — so this
 * is for a host that keeps its variables somewhere else:
 *
 * ```js
 * // a worker, whose bindings arrive with the request
 * import { setDynamicEnv } from "@implementjs/kit/env";
 *
 * export default {
 * 	fetch(request, env, context) {
 * 		setDynamicEnv(env);
 * 		return handler(request, { platform: { env, context } });
 * 	},
 * };
 * ```
 *
 * Values are re-validated when the source object changes identity, so calling
 * this once per request costs one assignment and nothing else.
 */
export function setDynamicEnv(source: Record<string, string | undefined>): void {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The slot is a well-known symbol on globalThis, shared across copies of kit.
	(globalThis as SourceHolder)[SOURCE_KEY] = source;
}

/**
 * The environment {@link defineDynamicEnv} reads: whatever {@link setDynamicEnv}
 * was last given, else `process.env`, else nothing at all — a worker with no
 * adapter glue and no node compatibility, where guessing would report every
 * variable as unset and blame the app.
 */
function dynamicSource(): Record<string, string | undefined> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The slot is a well-known symbol on globalThis, shared across copies of kit.
	const set = (globalThis as SourceHolder)[SOURCE_KEY];
	if (set !== undefined) return set;
	const fallback = processEnv();
	if (fallback !== undefined) return fallback;
	throw new Error(
		"defineDynamicEnv: no environment to read from.\n\n" +
			"This host exposes no `process.env`, and nothing called `setDynamicEnv`. " +
			"The adapter serving this app has to hand kit the environment — see `setDynamicEnv` in @implementjs/kit/env.",
	);
}

/** How a dynamic file names itself in errors: it has no path at runtime, only a call. */
const DYNAMIC_INFO: EnvFileInfo = { kind: "dynamic", file: "defineDynamicEnv", counterpart: "" };

const DYNAMIC_PUBLIC_INFO: EnvFileInfo = {
	kind: "dynamic-public",
	file: "defineDynamicPublicEnv",
	counterpart: "",
};

/**
 * A live view over the environment: `Env<T>`'s shape and types, but each read
 * goes to whatever {@link setDynamicEnv} currently points at rather than to a
 * value captured when the module loaded.
 *
 * The prefix rule is checked eagerly — it needs no values, so it can fail where
 * the mistake is. Everything else waits for the first read, because a module
 * can load before its environment exists.
 */
function liveEnv<T extends EnvSchemas>(schemas: T, info: EnvFileInfo): Env<T> {
	const keys = Object.keys(schemas);
	assertPrefixes(keys, info);

	/** The source the cache was built from, compared by identity. */
	let source: Record<string, string | undefined> | null = null;
	let values: Record<string, unknown> | null = null;

	const read = (): Record<string, unknown> => {
		const current = dynamicSource();
		if (values !== null && source === current) return values;
		values = validateEnv(schemas, current, info);
		source = current;
		return values;
	};

	const proxy = new Proxy<Record<string, unknown>>(
		{},
		{
			get(_target, key) {
				if (typeof key !== "string" || !Object.hasOwn(schemas, key)) return undefined;
				return read()[key];
			},
			has(_target, key) {
				return typeof key === "string" && Object.hasOwn(schemas, key);
			},
			ownKeys() {
				return keys;
			},
			// spreading, `Object.keys` and `JSON.stringify` all go through here; each
			// takes a snapshot, which is the honest reading of a value that can change
			getOwnPropertyDescriptor(_target, key) {
				if (typeof key !== "string" || !Object.hasOwn(schemas, key)) return undefined;
				return { value: read()[key], enumerable: true, configurable: true, writable: false };
			},
			set(_target, key) {
				throw new Error(`${info.file}: "${String(key)}" is read-only.`);
			},
			deleteProperty(_target, key) {
				throw new Error(`${info.file}: "${String(key)}" is read-only.`);
			},
		},
	);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A proxy over the declared keys is exactly `Env<T>`; only the mapped type expresses each key's output.
	return proxy as Env<T>;
}

/**
 * Declares environment variables the **running server** reads, rather than the
 * build. The counterpart to {@link defineEnv}, and the answer to rotating a
 * secret with a restart instead of a rebuild.
 *
 * ```ts
 * // src/lib/env.dynamic.server.ts
 * import { defineDynamicEnv } from "@implementjs/kit/env";
 * import * as v from "valibot";
 *
 * export const env = defineDynamicEnv({
 * 	BETTER_AUTH_SECRET: v.string(),
 * 	DATABASE_URL: v.string(),
 * });
 * ```
 *
 * The types are {@link defineEnv}'s — every key typed by its schema's output —
 * but the object is a live view rather than a snapshot. Reading a key validates
 * the whole set on first access and caches it until the environment underneath
 * is replaced, so a read costs a property lookup.
 *
 * Three things follow from being read at runtime rather than at build:
 *
 * - **`vite build` no longer fails on a missing variable.** There is nothing to
 *   validate against yet. The first read on the running server throws instead,
 *   with the same report naming every failing key.
 * - **The schemas ship.** Kit cannot replace this file with literals, so it and
 *   the schema library are part of the server bundle. They still never reach a
 *   browser: the file is named `*.server.ts` and the client copy is the same
 *   throwing stub every server file gets.
 * - **Prerendering reads the build's environment**, because that is the only
 *   one a prerender has. A page that prerenders a dynamic value bakes it in.
 *
 * The `PUBLIC_` prefix is refused here exactly as it is in `env.server.ts`. For
 * values that do ship to the browser, see {@link defineDynamicPublicEnv}.
 */
export function defineDynamicEnv<T extends EnvSchemas>(schemas: T): Env<T> {
	return liveEnv(schemas, DYNAMIC_INFO);
}

/**
 * Declares **public** environment variables the running server reads, for
 * values the browser needs and a rebuild should not be the way to change.
 *
 * ```ts
 * // src/lib/env.dynamic.public.ts
 * import { defineDynamicPublicEnv } from "@implementjs/kit/env";
 * import * as v from "valibot";
 *
 * export const env = defineDynamicPublicEnv({
 * 	PUBLIC_API_URL: v.pipe(v.string(), v.url()),
 * });
 * ```
 *
 * Every key must start with `PUBLIC_`, as in `env.public.ts` — these values are
 * shipped to every visitor.
 *
 * Only the server ever runs this call. Kit replaces the module in the client
 * graph with one that reads the values the page carries, already validated and
 * already coerced, so the schemas and the schema library stay out of the
 * browser bundle exactly as they do for the static public file. What the page
 * carries, and what it costs, is covered in the environment-variables guide.
 */
export function defineDynamicPublicEnv<T extends EnvSchemas>(schemas: T): Env<T> {
	return liveEnv(schemas, DYNAMIC_PUBLIC_INFO);
}

/**
 * Where a page publishes its public env for the client copy of
 * `env.dynamic.public.ts` to read. A prerendered page has no values of its
 * own, so it loads a module from the server that assigns this slot before the
 * app's entry runs.
 */
export const PUBLIC_ENV_GLOBAL = "__implement_public_env";

/**
 * Every export of the public dynamic env module, as plain JSON-able values —
 * what a page carries and what `/{@link PUBLIC_ENV_ROUTE}` serves. Spreading is
 * what turns the live proxy into a snapshot.
 *
 * @throws {Error} from the module's own validation, if a variable is missing.
 */
export function publicEnvSnapshot(namespace: Record<string, unknown>): Record<string, unknown> {
	const snapshot: Record<string, unknown> = {};
	for (const name of Object.keys(namespace)) {
		const value = namespace[name];
		// spreading is what turns `env` — a live proxy — into the values it is
		// currently reading; anything else the module exports is copied as it is
		snapshot[name] = typeof value === "object" && value !== null ? { ...value } : value;
	}
	return snapshot;
}

/** The path kit answers with the current public env, for pages that were prerendered without it. */
export const PUBLIC_ENV_ROUTE = "_implement/env.js";

/**
 * The module kit serves at {@link PUBLIC_ENV_ROUTE}: the current values,
 * assigning {@link PUBLIC_ENV_GLOBAL} so the client copy of the env file finds
 * them. A module script, so document order alone puts it before the app's entry.
 */
export function publicEnvBootModule(values: Record<string, unknown>): string {
	return `globalThis[${JSON.stringify(PUBLIC_ENV_GLOBAL)}] = ${JSON.stringify(values)};\n`;
}

/**
 * Publishes an evaluation context for the length of `run`, so the copy of
 * `defineEnv` inside an evaluated bundle — a different module instance, or the
 * generated shim — reaches the plugin's live implementation. Restores whatever
 * was there before, because the plugin half evaluates files one at a time on a
 * queue and a nested evaluation must not strand the outer one.
 */
export async function withEnvContext<T>(context: EnvContext, run: () => Promise<T>): Promise<T> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The context is published on globalThis so the evaluated bundle's own defineEnv finds it.
	const holder = globalThis as ContextHolder;
	const previous = holder[CONTEXT_KEY];
	holder[CONTEXT_KEY] = context;
	try {
		return await run();
	} finally {
		if (previous === undefined) delete holder[CONTEXT_KEY];
		else holder[CONTEXT_KEY] = previous;
	}
}
