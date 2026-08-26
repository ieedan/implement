import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
	PUBLIC_ENV_GLOBAL,
	PUBLIC_ENV_ROUTE,
	validateEnv,
	withEnvContext,
	type EnvFileInfo,
	type EnvSchemas,
} from "./env-runtime.ts";
import type { ServerKind } from "./guard.ts";
import { loadEnv } from "vite";

/**
 * The plugin half of the env feature: bundling an env file with esbuild,
 * evaluating it in Node, and re-emitting it as literals. The half that runs
 * where the app runs — `defineEnv`, `defineDynamicEnv`, the validation they
 * share — lives in `./env-runtime.ts`, which carries none of this and so can
 * ship inside a server bundle.
 */
export {
	assertPrefixes,
	defineDynamicEnv,
	defineDynamicPublicEnv,
	defineEnv,
	PUBLIC_ENV_GLOBAL,
	PUBLIC_ENV_ROUTE,
	publicEnvBootModule,
	PUBLIC_PREFIX,
	publicEnvSnapshot,
	setDynamicEnv,
	validateEnv,
	withEnvContext,
	type Env,
	type EnvContext,
	type EnvFileInfo,
	type EnvKind,
	type EnvSchemas,
} from "./env-runtime.ts";

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

	const context = {
		values,
		info,
		defineEnv: (schemas: EnvSchemas) => validateEnv(schemas, values, info),
	};
	return withEnvContext(context, async () => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A module namespace is exactly a record of its exports.
		const namespace = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
		const exports: Record<string, unknown> = {};
		for (const name of Object.keys(namespace)) exports[name] = namespace[name];
		assertSerializable(exports, info.file);
		return exports;
	});
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
export function serverStubModule(
	names: string[],
	file: string,
	kind: ServerKind = "server",
): string {
	const message =
		`${file} is ${kind === "endpoint" ? "a route endpoint" : "a server file"} and cannot run in the browser. ` +
		`Its values were never included in this bundle. ` +
		`Move what the client needs into a shared module, or use \`import type\` if you only need its types.`;
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

/**
 * The client copy of the public dynamic env file: the module's shape, and each
 * export read from the values the page carries. No schemas and no schema
 * library, because the server already validated and coerced them — the same
 * promise the static public file makes, kept for a value that is not known
 * until a request.
 *
 * A page that kit server-rendered embeds them; one that was prerendered has a
 * module from the server assign {@link PUBLIC_ENV_GLOBAL} before the app's
 * entry runs, and that wins, being the fresher of the two.
 */
export function publicEnvClientModule(names: string[], file: string): string {
	const message =
		`${file} has no values on this page. ` +
		`Kit embeds them when it renders a page — a document built without kit's pipeline carries none.`;
	const bindings = names.map((name, index) => `__public_${index} as ${exportAlias(name)}`);
	const lines = [
		`// ${file} - values come from the page; validated on the server`,
		`const __values = (() => {`,
		`\tconst seeded = globalThis[${JSON.stringify(PUBLIC_ENV_GLOBAL)}];`,
		`\tif (seeded !== undefined) return seeded;`,
		`\tconst tag = document.querySelector("script[data-implement-env]");`,
		`\tif (tag !== null && tag.textContent) return JSON.parse(tag.textContent);`,
		`\tthrow new Error(${JSON.stringify(message)});`,
		`})();`,
	];
	for (const [index, name] of names.entries()) {
		lines.push(`const __public_${index} = __values[${JSON.stringify(name)}];`);
	}
	lines.push(`export {${bindings.length === 0 ? "" : ` ${bindings.join(", ")} `}};`);
	return `${lines.join("\n")}\n`;
}

/**
 * Puts kit's public-env module first in the document's `<head>`. Module scripts
 * run in document order, so being first is the whole mechanism: the values are
 * assigned before the app's entry — and so before any module that reads them —
 * evaluates.
 *
 * Only prerendered documents need this. A page kit rendered for a request
 * already carries its values.
 */
export function injectPublicEnvBoot(html: string, base: string): string {
	const prefix = base.endsWith("/") ? base : `${base}/`;
	return html.replace(
		/<head([^>]*)>/,
		`<head$1><script type="module" src="${prefix}${PUBLIC_ENV_ROUTE}"></script>`,
	);
}
