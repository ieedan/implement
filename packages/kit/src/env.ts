import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { build } from "esbuild";
import { loadEnv } from "vite";

/** The prefix every key in the public env file must carry, and the server file must not. */
export const PUBLIC_PREFIX = "PUBLIC_";

/** Which of the two env files a set of schemas came from. */
export type EnvKind = "public" | "server";

/** One env file, as the error messages refer to it — paths relative to the app root. */
export type EnvFileInfo = {
	kind: EnvKind;
	/** The file being evaluated, relative to the app root. */
	file: string;
	/** The other file, named in prefix errors as the place a key belongs instead. */
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
type EnvContext = {
	values: Record<string, string | undefined>;
	info: EnvFileInfo;
	defineEnv: (schemas: EnvSchemas) => Record<string, unknown>;
};

const CONTEXT_KEY = Symbol.for("@implementjs/kit:env-context");

type ContextHolder = { [CONTEXT_KEY]?: EnvContext };

/**
 * Declares an app's environment variables and returns them validated.
 *
 * Each key maps to a [Standard Schema](https://standardschema.dev) — zod,
 * valibot, arktype, anything implementing the spec — and the returned object is
 * typed by each schema's output, so `typeof env` flows straight into every
 * module that imports it. No code generation is involved.
 *
 * ```ts
 * // src/lib/env.public.ts
 * import { defineEnv } from "@implementjs/kit";
 * import { z } from "zod";
 *
 * export const env = defineEnv({ PUBLIC_DOCS_URL: z.url() });
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
 */
export function defineEnv<T extends EnvSchemas>(schemas: T): Env<T> {
	// oxlint-disable typescript/no-unsafe-type-assertion -- The evaluation context lives on globalThis, and each key's output type is the schema's, which only the mapped type expresses.
	const context = (globalThis as ContextHolder)[CONTEXT_KEY];
	if (context !== undefined) return context.defineEnv(schemas) as Env<T>;
	return validateEnv(schemas, process.env, null) as Env<T>;
	// oxlint-enable typescript/no-unsafe-type-assertion
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
		failures.push(`${key} - ${value === undefined ? "not set" : formatIssues(validated.issues)}`);
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

function formatIssues(issues: readonly StandardSchemaV1.Issue[]): string {
	return issues
		.map((issue) => {
			const path = (issue.path ?? [])
				.map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
				.join(".");
			return path === "" ? issue.message : `${path}: ${issue.message}`;
		})
		.join("; ");
}

/**
 * The safety net the type system was never going to provide: a key's prefix,
 * not the file it happens to sit in, decides whether it may ship to a browser.
 */
function assertPrefixes(keys: string[], info: EnvFileInfo): void {
	if (info.kind === "public") {
		const unprefixed = keys.filter((key) => !key.startsWith(PUBLIC_PREFIX));
		if (unprefixed.length === 0) return;
		throw new Error(
			`${info.file}: ${list(unprefixed)} must start with ${PUBLIC_PREFIX}.\n\n` +
				`Every variable in this file is inlined into the client bundle and shipped to the browser. ` +
				`Move ${unprefixed.length === 1 ? "it" : "them"} to ${info.counterpart}, or add the ${PUBLIC_PREFIX} prefix if the value is safe to expose.`,
		);
	}
	const prefixed = keys.filter((key) => key.startsWith(PUBLIC_PREFIX));
	if (prefixed.length === 0) return;
	throw new Error(
		`${info.file}: ${list(prefixed)} must not start with ${PUBLIC_PREFIX}.\n\n` +
			`${PUBLIC_PREFIX} is reserved for ${info.counterpart}, whose values ship to the browser. ` +
			`Move ${prefixed.length === 1 ? "it" : "them"} there, or drop the prefix.`,
	);
}

function list(keys: string[]): string {
	const quoted = keys.map((key) => `"${key}"`);
	if (quoted.length === 1) return quoted[0]!;
	return `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

/**
 * The raw values an env file validates against: Vite's own `.env` resolution
 * (`.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`) with no prefix
 * filter, layered under `process.env`. `loadEnv` does not populate
 * `process.env`, so kit sources the values itself rather than leaving the env
 * files to read a `process.env` that never sees `.env` at all.
 */
export function loadRawEnv(mode: string, root: string): Record<string, string> {
	return loadEnv(mode, root, "");
}

/**
 * Every export of an env file, evaluated in Node. Memoized on the hash of the
 * bundled source and the raw values, because evaluation is requested by the dev
 * SSR graph, the client graph, and again by the prerender's throwaway server —
 * which re-reads `vite.config.ts`, so kit's plugins load twice per build.
 *
 * @throws {Error} propagated from the module: validation and prefix failures.
 */
export async function evaluateEnvFile(options: {
	/** Absolute path of the env file. */
	path: string;
	info: EnvFileInfo;
	values: Record<string, string | undefined>;
	/** App root, under whose `node_modules` the evaluated bundle is cached. */
	root: string;
	/** Extra import aliases to resolve, absolute (kit's `@/lib` and friends). */
	alias?: Record<string, string>;
}): Promise<Record<string, unknown>> {
	const code = await bundleEnvFile(options.path, options.alias);
	const key = hash(`${options.info.kind}\0${code}\0${JSON.stringify(options.values)}`);
	const cached = evaluations.get(key);
	if (cached !== undefined) return cached;

	const pending = enqueue(() =>
		runEnvModule(code, key, options.root, options.info, options.values),
	);
	evaluations.set(key, pending);
	// a failed evaluation must not be remembered — the user fixes .env and retries
	pending.catch(() => evaluations.delete(key));
	return pending;
}

const evaluations = new Map<string, Promise<Record<string, unknown>>>();

/** Evaluations share one `globalThis` slot, so they run one at a time. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(run: () => Promise<T>): Promise<T> {
	const next = queue.then(run, run);
	queue = next.then(
		() => undefined,
		() => undefined,
	);
	return next;
}

async function runEnvModule(
	code: string,
	key: string,
	root: string,
	info: EnvFileInfo,
	values: Record<string, string | undefined>,
): Promise<Record<string, unknown>> {
	const dir = join(root, "node_modules", ".implement", "env");
	mkdirSync(dir, { recursive: true });
	// hash-named, so a changed file is a new url and never hits node's module cache
	const file = join(dir, `${key}.mjs`);
	if (!existsSync(file)) writeFileSync(file, code);

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The evaluation context is published on globalThis so the evaluated bundle's own defineEnv finds it.
	const holder = globalThis as ContextHolder;
	const previous = holder[CONTEXT_KEY];
	holder[CONTEXT_KEY] = {
		values,
		info,
		defineEnv: (schemas) => validateEnv(schemas, values, info),
	};
	try {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A module namespace is exactly a record of its exports.
		const namespace = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
		const exports: Record<string, unknown> = {};
		for (const name of Object.keys(namespace)) exports[name] = namespace[name];
		assertSerializable(exports, info.file);
		return exports;
	} finally {
		if (previous === undefined) delete holder[CONTEXT_KEY];
		else holder[CONTEXT_KEY] = previous;
	}
}

const SHIM = `const KEY = Symbol.for("@implementjs/kit:env-context");
export function defineEnv(schemas) {
	const context = globalThis[KEY];
	if (context === undefined) throw new Error("defineEnv was called outside a kit env evaluation");
	return context.defineEnv(schemas);
}
`;

/**
 * The env file as one ESM module for Node. Bare specifiers stay external —
 * they resolve from the app's own `node_modules` at import time — except
 * `@implementjs/kit`, which is swapped for a shim delegating to the plugin's
 * live `defineEnv`. Resolving the real package would work in an app and load a
 * second copy of kit; the shim works everywhere and loads none.
 */
async function bundleEnvFile(path: string, alias?: Record<string, string>): Promise<string> {
	const result = await build({
		entryPoints: [path],
		bundle: true,
		write: false,
		format: "esm",
		platform: "node",
		target: "node20",
		packages: "external",
		alias,
		logLevel: "silent",
		plugins: [
			{
				name: "implement-kit-env-shim",
				setup(esbuild) {
					esbuild.onResolve({ filter: /^@implementjs\/kit$/ }, () => ({
						path: "env-shim",
						namespace: SHIM_NAMESPACE,
					}));
					esbuild.onLoad({ filter: /.*/, namespace: SHIM_NAMESPACE }, () => ({
						contents: SHIM,
						loader: "js" as const,
					}));
				},
			},
		],
	});
	return result.outputFiles[0]!.text;
}

const SHIM_NAMESPACE = "implement-kit-env";

/**
 * The export names of a module, without running it. Used for the client copy of
 * a server file, which has to keep the module's shape so importers still link
 * while holding none of its values.
 */
export async function exportNames(path: string): Promise<string[]> {
	try {
		const result = await build({
			entryPoints: [path],
			bundle: false,
			write: false,
			format: "esm",
			metafile: true,
			logLevel: "silent",
		});
		const output = Object.values(result.metafile.outputs)[0];
		return output?.exports ?? [];
	} catch {
		// a file that does not even parse has no shape to preserve; the throw is enough
		return [];
	}
}

/**
 * Whole-module replacement inlines every export, so every export has to survive
 * `JSON.stringify` — a function would silently become nothing.
 *
 * @throws {Error} naming the export and what it is.
 */
export function assertSerializable(exports: Record<string, unknown>, file: string): void {
	for (const name of Object.keys(exports)) {
		const problem = findUnserializable(exports[name], name, new Set());
		if (problem === null) continue;
		throw new Error(
			`${file} is evaluated at build time and its exports are inlined; "${problem.path}" is ${problem.describe} and cannot be inlined. Please move it to another module.`,
		);
	}
}

type Unserializable = { path: string; describe: string };

function findUnserializable(
	value: unknown,
	path: string,
	seen: Set<object>,
): Unserializable | null {
	if (value === null) return null;
	switch (typeof value) {
		case "string":
		case "boolean":
			return null;
		case "number":
			return Number.isFinite(value) ? null : { path, describe: `${value}` };
		case "undefined":
			return { path, describe: "undefined" };
		case "function":
			return { path, describe: "a function" };
		case "symbol":
			return { path, describe: "a symbol" };
		case "bigint":
			return { path, describe: "a bigint" };
	}

	const object: object = value;
	if (seen.has(object)) return { path, describe: "a circular reference" };
	seen.add(object);
	try {
		if (Array.isArray(object)) {
			for (const [index, entry] of object.entries()) {
				const problem = findUnserializable(entry, `${path}[${index}]`, seen);
				if (problem !== null) return problem;
			}
			return null;
		}
		const prototype = Object.getPrototypeOf(object);
		if (prototype !== Object.prototype && prototype !== null) {
			return { path, describe: `a ${object.constructor?.name ?? "class instance"}` };
		}
		for (const [key, entry] of Object.entries(object)) {
			const problem = findUnserializable(entry, `${path}.${key}`, seen);
			if (problem !== null) return problem;
		}
		return null;
	} finally {
		seen.delete(object);
	}
}

/** The evaluated exports of an env file, re-emitted as a module of literals. */
export function serializeEnvModule(exports: Record<string, unknown>, file: string): string {
	const names = Object.keys(exports);
	const lines = [`// ${file} - evaluated by @implementjs/kit and inlined`];
	const bindings: string[] = [];
	for (const [index, name] of names.entries()) {
		lines.push(`const __env_${index} = ${JSON.stringify(exports[name])};`);
		bindings.push(`__env_${index} as ${exportAlias(name)}`);
	}
	lines.push(`export {${bindings.length === 0 ? "" : ` ${bindings.join(", ")} `}};`);
	return `${lines.join("\n")}\n`;
}

/**
 * The client copy of a server file: the module's shape, none of its values, and
 * a body that throws the moment anything evaluates it. The backstop for what
 * the import guard cannot see — computed dynamic imports, re-export chains,
 * anything that slips.
 */
export function serverStubModule(names: string[], file: string): string {
	const message =
		`${file} is a server file and cannot run in the browser. ` +
		`Its values were never included in this bundle. ` +
		`Import server-only modules from another *.server.ts, or use \`import type\` if you only need its types.`;
	const bindings = names.map((name, index) => `__server_${index} as ${exportAlias(name)}`);
	const lines = [
		`// ${file} - server-only; the client copy holds no values`,
		`throw new Error(${JSON.stringify(message)});`,
	];
	// declared after the throw so nothing can read them, but still statically exported so
	// importers link and fail at evaluation rather than at bundle time
	for (const [index] of names.entries()) lines.push(`const __server_${index} = undefined;`);
	lines.push(`export {${bindings.length === 0 ? "" : ` ${bindings.join(", ")} `}};`);
	return `${lines.join("\n")}\n`;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** `export { x as name }`, quoting names that are not identifiers. */
function exportAlias(name: string): string {
	return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

function hash(input: string): string {
	return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
