/**
 * The OpenAPI 3.1 document for an app's `server.ts` endpoints — built from the
 * schemas a route declared, and only when an app asks for one.
 *
 * ```ts
 * kit({
 * 	api: {
 * 		openapi: {
 * 			info: { title: "Docs API", version: "1.0.0" },
 * 			output: "static/openapi.json",
 * 			path: "/openapi.json", // optional: also mount a live route
 * 		},
 * 	},
 * });
 * ```
 *
 * With `api.openapi` absent — the default — no document is produced, no file
 * is written, and no route is mounted. A route table is not something to
 * publish by accident.
 *
 * Unlike everything else in the API layer, this needs the schema *objects*, so
 * the route modules have to be evaluated: in dev through
 * `server.ssrLoadModule`, at build time through the prerender's module runner.
 * Both run in Node, so the schema library and its JSON-Schema converter never
 * reach the production server bundle — unless the app mounts the live `path`,
 * which is exactly why that is a separate option.
 *
 * Standard Schema has no JSON-Schema introspection of its own, so the
 * conversion is per-vendor and detected from `~standard.vendor`. Anything kit
 * does not recognize documents as an unconstrained schema and says so.
 *
 * The converter a vendor needs is a package of its own (`zod`'s own entry,
 * `@valibot/to-json-schema`), and the runtime paths — the live `path` route and
 * every MCP `tools/list` — need it *in the bundle*. Reaching it through a
 * variable specifier would leave it out of one, so kit's Vite plugin builds
 * `$implement/schema-converters` out of the converter packages the app has
 * installed, with a static import each. See {@link CONVERTER_PACKAGES}.
 */

// `$implement/schema-converters` exists only inside a kit build, so its
// declaration travels with the one file that names it — anything compiling this
// source, kit's own tsconfig or a package that consumes `src/`, gets it here.
// An ambient module declaration is not something an `import` can carry, which is
// the one case the rule below is not written for.
// oxlint-disable-next-line typescript/triple-slash-reference -- Declares a module that exists only at build time; an import cannot bring an ambient declaration along.
/// <reference path="./schema-converters.d.ts" />

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { handlerDefinition, type HandlerDefinition, type Method } from "./endpoint.ts";
import type { EndpointRoute, RequestHandler } from "./match.ts";
import { JSON_SCHEMA, KIT_VENDOR, type ParamMatchers } from "./params.ts";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

/** Which shape of a schema a conversion wants: what a caller sends, or what it gets back. */
export type SchemaIo = "input" | "output";

/** Turns a Standard Schema into JSON Schema. `null` when the vendor is not one kit knows. */
export type ToJsonSchema = (
	schema: StandardSchemaV1,
	io: SchemaIo,
) => JsonSchema | Promise<JsonSchema>;

/** Whatever the vendor's converter produced — kit only ever passes it through. */
export type JsonSchema = Record<string, unknown>;

export type OpenApiOptions = {
	/** The document's `info` block. Required: a document without one is not a document. */
	info: { title: string; version: string; description?: string } & Record<string, unknown>;
	/**
	 * Where the build writes the document, relative to the Vite root. A path
	 * under the public dir (`static/openapi.json`) ships it as a plain file the
	 * host serves; kit serves the same URL in dev.
	 */
	output?: string;
	/**
	 * Also mount a live route serving the document. This is the one path that
	 * pulls the schema library and its converter into the production server
	 * bundle, which is why it is separate from {@link OpenApiOptions.output}.
	 */
	path?: string;
	servers?: { url: string; description?: string }[];
	/**
	 * Converts a Standard Schema to JSON Schema, when kit's own vendor
	 * detection is not what you want. Ignored by the live `path` route, which
	 * is generated code and cannot carry a function.
	 */
	toJsonSchema?: ToJsonSchema;
};

/** One param a route key binds, with the matcher gating it. */
export type OpenApiParam = {
	name: string;
	/** The matcher a `[id=integer]` segment names, or `null` for a plain `[id]`. */
	matcher?: string | null;
};

/** One endpoint as the document builder sees it: its key, its params, and its evaluated module. */
export type OpenApiEndpoint = {
	/** The route key — `/api/posts/[id]`, `/posts/[id=integer]`, `/docs/[...slug].md`. */
	key: string;
	/** The params the key binds, root first. */
	params: OpenApiParam[];
	/** Relative path of the `server.ts`, for warnings. */
	file: string;
	/** The evaluated module namespace. */
	module: Record<string, unknown>;
};

export type OpenApiDocument = {
	openapi: "3.1.0";
	info: OpenApiOptions["info"];
	servers?: { url: string; description?: string }[];
	paths: Record<string, Record<string, unknown>>;
};

export type OpenApiResult = {
	document: OpenApiDocument;
	/** What could not be documented, each naming the route it came from. */
	warnings: string[];
};

/**
 * The document for a set of endpoints. Routes opting out with
 * `export const openapi = false;` are skipped; a method with no schemas at all
 * is still listed, as a path and a method with an undocumented body — a route
 * that exists is worth saying so, and inference is for the client.
 */
export async function buildOpenApiDocument(
	endpoints: OpenApiEndpoint[],
	options: OpenApiOptions,
	matchers: ParamMatchers = {},
): Promise<OpenApiResult> {
	const warnings: string[] = [];
	const convert = converter(options.toJsonSchema, warnings);
	const paths: Record<string, Record<string, unknown>> = {};
	/** Which route each path template's operations came from, for the collision warning. */
	const documented = new Map<string, string>();

	for (const endpoint of endpoints) {
		if (endpoint.module["openapi"] === false) continue;
		const path = openApiPath(endpoint.key);
		const previous = documented.get(path);
		for (const method of METHODS) {
			const value = endpoint.module[method];
			if (typeof value !== "function") continue;
			// a path template has no room for a matcher, so `[id=integer]` and
			// `[id=uuid]` — two routes as far as the app is concerned — are one
			// path here, and the second one through wins
			if (previous !== undefined && paths[path]?.[method.toLowerCase()] !== undefined) {
				warnings.push(
					`${method} ${endpoint.file}: "${path}" is already documented by "${previous}" — two routes reach the same path template, so only one of them can be.`,
				);
			}
			const operation = await describeOperation({
				endpoint,
				method,
				definition: handlerDefinition(value),
				convert,
				matchers,
			});
			paths[path] = { ...paths[path], [method.toLowerCase()]: operation };
		}
		documented.set(path, endpoint.file);
	}

	const document: OpenApiDocument = {
		openapi: "3.1.0",
		info: options.info,
		...(options.servers === undefined ? {} : { servers: options.servers }),
		paths,
	};
	return { document, warnings };
}

/**
 * The route key as a path template: `/api/posts/[id]` → `/api/posts/{id}`,
 * `/docs/[...slug].md` → `/docs/{slug}.md`.
 *
 * A `[id=integer]` matcher comes off with the brackets. It gates which route a
 * request reaches, which is the app's business and not the URL's — and a
 * template naming `{id=integer}` names a parameter no document declares, so a
 * generated client or a Swagger UI has nothing to fill it with.
 */
export function openApiPath(key: string): string {
	return key.replaceAll(PARAM_SEGMENT, "{$1}");
}

/** `[id]`, `[...slug]`, `[id=integer]` — capturing the name, dropping the matcher. */
const PARAM_SEGMENT = /\[(?:\.\.\.)?([^\]=]+)(?:=[^\]]+)?\]/g;

/** `GET /api/posts/[id]` → `getApiPostsById` — stable, and unique per method and route. */
export function operationId(method: string, key: string): string {
	const parts = key
		.replaceAll(PARAM_SEGMENT, "by-$1")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	return [
		method.toLowerCase(),
		...parts.map((part) => part[0]!.toUpperCase() + part.slice(1)),
	].join("");
}

type Converter = (
	schema: StandardSchemaV1,
	io: SchemaIo,
	where: string,
) => Promise<JsonSchema | null>;

async function describeOperation(input: {
	endpoint: OpenApiEndpoint;
	method: Method;
	definition: HandlerDefinition | null;
	convert: Converter;
	matchers: ParamMatchers;
}): Promise<Record<string, unknown>> {
	const { endpoint, method, definition, convert, matchers } = input;
	const where = `${method} ${endpoint.file}`;
	const operation: Record<string, unknown> = {
		operationId: operationId(method, endpoint.key),
		parameters: await parameters(endpoint, definition, convert, where, matchers),
	};

	if (definition?.body !== undefined) {
		const schema = await convert(definition.body, "input", `${where} body`);
		operation["requestBody"] = {
			required: true,
			content: { "application/json": { schema: schema ?? {} } },
		};
	}

	const response =
		definition?.response === undefined
			? null
			: await convert(definition.response, "output", `${where} response`);
	operation["responses"] = {
		"200": {
			description: "OK",
			content: { "application/json": { schema: response ?? {} } },
		},
		...(hasValidation(definition)
			? { "400": { description: "the request failed validation" } }
			: {}),
	};
	return operation;
}

function hasValidation(definition: HandlerDefinition | null): boolean {
	if (definition === null) return false;
	return (
		definition.params !== undefined ||
		definition.query !== undefined ||
		definition.body !== undefined
	);
}

/** Path params come from the route key; query params from the `query` schema, when there is one. */
async function parameters(
	endpoint: OpenApiEndpoint,
	definition: HandlerDefinition | null,
	convert: Converter,
	where: string,
	matchers: ParamMatchers,
): Promise<Record<string, unknown>[]> {
	const list: Record<string, unknown>[] = [];
	const pathSchemas =
		definition?.params === undefined
			? {}
			: properties(await convert(definition.params, "input", `${where} params`));
	for (const param of endpoint.params) {
		list.push({
			name: param.name,
			in: "path",
			required: true,
			// what the handler declares, else what the matcher makes of the
			// segment, else the string it arrived as
			schema: pathSchemas[param.name] ??
				(await matcherSchema(param, matchers, convert, where)) ?? { type: "string" },
		});
	}

	if (definition?.query === undefined) return list;
	const query = await convert(definition.query, "input", `${where} query`);
	const required = new Set(requiredNames(query));
	for (const [name, schema] of Object.entries(properties(query))) {
		list.push({ name, in: "query", required: required.has(name), schema });
	}
	return list;
}

/**
 * What a `[id=integer]` param carries, converted from the matcher's own schema
 * — the same conversion a handler's `params` schema goes through, so the
 * document says `integer` exactly where kit's types say `number`. A matcher
 * built from a pattern or a bare function has no schema to convert and leaves
 * the param the string it arrived as.
 */
async function matcherSchema(
	param: OpenApiParam,
	matchers: ParamMatchers,
	convert: Converter,
	where: string,
): Promise<JsonSchema | null> {
	if (param.matcher === undefined || param.matcher === null) return null;
	const schema = matchers[param.matcher]?.schema;
	if (schema === undefined || schema === null) return null;
	return await convert(schema, "output", `${where} [${param.name}=${param.matcher}]`);
}

function properties(schema: JsonSchema | null): Record<string, unknown> {
	const value = schema?.["properties"];
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Whatever the vendor produced under `properties` is a record of schemas or nothing.
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function requiredNames(schema: JsonSchema | null): string[] {
	const value = schema?.["required"];
	return Array.isArray(value) ? value.filter((name) => typeof name === "string") : [];
}

// ---------------------------------------------------------------------------
// Vendor detection
// ---------------------------------------------------------------------------

/**
 * Wraps the conversion so one unrecognized vendor documents as `{}` and warns
 * rather than failing the build — a route table with an unconstrained schema in
 * it is still a useful document.
 */
function converter(custom: ToJsonSchema | undefined, warnings: string[]): Converter {
	return async (schema, io, where) => {
		try {
			if (custom !== undefined) return inlinable(await custom(schema, io));
			const vendor = schema["~standard"].vendor;
			const convert = await vendorConverter(vendor);
			if (convert === null) {
				warnings.push(
					`${where}: kit cannot convert a "${vendor}" schema to JSON Schema — documenting it as unconstrained. Pass api.openapi.toJsonSchema to do it yourself.`,
				);
				return null;
			}
			return inlinable(await convert(schema, io));
		} catch (error) {
			warnings.push(
				`${where}: converting the schema to JSON Schema failed — ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	};
}

/**
 * A converted schema as it can be inlined into the document.
 *
 * The converters stamp a `$schema` on what they hand back — draft-07 from
 * valibot, 2020-12 from zod — declaring the dialect of a document they think
 * they are the root of. Inlined into an operation they are not: the dialect of
 * a schema inside an OpenAPI 3.1 document is the document's, which is 2020-12,
 * and a `$schema` disagreeing with it in every operation is something a strict
 * validator is entitled to complain about. So it comes off, wherever the
 * schema came from — kit's own converters or an app's `toJsonSchema`.
 */
function inlinable(schema: JsonSchema): JsonSchema {
	if (!("$schema" in schema)) return schema;
	const fragment = { ...schema };
	delete fragment["$schema"];
	return fragment;
}

/**
 * The converter packages kit knows how to reach, by the vendor that needs one.
 * `arktype` is absent on purpose: its types carry their own converter, so there
 * is nothing to import.
 */
export const CONVERTER_PACKAGES: Readonly<Record<string, string>> = {
	zod: "zod",
	valibot: "@valibot/to-json-schema",
};

/**
 * The converters the build bundled, keyed by package name.
 *
 * This is the whole reason the registry exists. A converter reached only
 * through `import(someVariable)` is invisible to the bundler, so it is never
 * written into the server bundle — and a serverless adapter ships that bundle
 * with no `node_modules` beside it, so nothing can resolve the specifier at
 * runtime either. Every conversion then fails, and an MCP server serves 30
 * tools the model cannot call.
 *
 * So kit's Vite plugin builds this module out of the converter packages the app
 * actually has installed, with a static import each — the bundler sees those,
 * and what it sees, it ships.
 */
type ConverterModules = Record<string, Record<string, unknown>>;

let bundled: Promise<ConverterModules> | undefined;

function bundledConverters(): Promise<ConverterModules> {
	// the specifier is a literal so Vite's import analysis rewrites it; outside a
	// kit build — Node, vitest, the build-time module runner — it resolves to
	// nothing and `loadModule` falls back to resolving the package itself
	bundled ??= import("$implement/schema-converters").then(
		(module) => module.converters,
		() => ({}),
	);
	return bundled;
}

/**
 * A vendor's converter package: the copy the build bundled, else the one the
 * runtime can resolve for itself. A deployed bundle only ever has the first —
 * see {@link CONVERTER_PACKAGES} — and a failure here is a real one, so it is
 * thrown rather than swallowed into an unconstrained schema nobody notices.
 */
async function loadModule(name: string): Promise<Record<string, unknown>> {
	const inBundle = (await bundledConverters())[name];
	if (inBundle !== undefined) return inBundle;
	try {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A dynamic import's namespace is only ever a record of exports.
		return (await import(/* @vite-ignore */ name)) as Record<string, unknown>;
	} catch (error) {
		throw new Error(
			`kit needs "${name}" to convert this schema to JSON Schema and cannot reach it. Install it as a dependency of the app so the build can bundle it, or build the JSON Schema yourself — a tool's \`inputJsonSchema\` for an MCP route, \`api.openapi.toJsonSchema\` for the document.`,
			{ cause: error },
		);
	}
}

/**
 * One schema converted outside the document builder — what the MCP route uses
 * to build a tool's `inputSchema` from the same declarations the endpoints
 * carry.
 *
 * `null` means only one thing: the vendor is not one kit knows, so there is no
 * conversion to attempt and the caller decides what an unconstrained schema
 * looks like in its document. A converter that cannot be reached or that fails
 * on the schema throws instead — that is a build or a deployment being wrong,
 * not a schema with no JSON-Schema spelling, and answering it with an
 * unconstrained schema hides it behind a tool the model cannot call.
 */
export async function convertStandardSchema(
	schema: StandardSchemaV1,
	io: SchemaIo,
): Promise<JsonSchema | null> {
	const convert = await vendorConverter(schema["~standard"].vendor);
	return convert === null ? null : await convert(schema, io);
}

/** The JSON-Schema converter for a Standard Schema vendor, or `null` for one kit does not know. */
async function vendorConverter(vendor: string): Promise<ToJsonSchema | null> {
	if (vendor === KIT_VENDOR) {
		// kit's own built-in matchers, which have no vendor package to convert
		// them — they carry their JSON Schema instead, so `[id=integer]` is
		// documented as an integer rather than as an unconstrained schema with a
		// warning, which would make the matchers most apps reach for the worst
		// documented ones
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The symbol is kit's own, on a schema kit built.
		return (schema) => (schema as { [JSON_SCHEMA]?: JsonSchema })[JSON_SCHEMA] ?? {};
	}
	if (vendor === "zod") {
		const zod = await loadModule(CONVERTER_PACKAGES["zod"]!);
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- zod's own converter, reached through a dynamic import.
		const toJSONSchema = zod["toJSONSchema"] as (schema: unknown, options: unknown) => JsonSchema;
		// `unrepresentable: "any"` because a transform or a `Date` is a perfectly
		// good schema that simply has no JSON-Schema spelling — documenting it as
		// unconstrained beats refusing to document the route
		return (schema, io) => toJSONSchema(schema, { io, unrepresentable: "any" });
	}
	if (vendor === "arktype") {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- arktype types carry their own converter.
		return (schema) => (schema as unknown as { toJsonSchema: () => JsonSchema }).toJsonSchema();
	}
	if (vendor === "valibot") {
		const valibot = await loadModule(CONVERTER_PACKAGES["valibot"]!);
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- valibot's converter ships in its own package.
		const toJsonSchema = valibot["toJsonSchema"] as (
			schema: unknown,
			options: unknown,
		) => JsonSchema;
		// `errorMode: "ignore"` for the same reason zod gets `unrepresentable: "any"`:
		// a transform is a perfectly good schema that simply has no JSON-Schema
		// spelling, and documenting it as unconstrained beats refusing to document
		// the route it is on
		return (schema) => toJsonSchema(schema, { errorMode: "ignore" });
	}
	return null;
}

// ---------------------------------------------------------------------------
// The live route
// ---------------------------------------------------------------------------

/** The serializable half of the options — what generated code can carry. */
export type OpenApiRouteOptions = Omit<OpenApiOptions, "toJsonSchema">;

/**
 * The endpoint behind `api.openapi.path`, built by the generated
 * `$implement/endpoints` module. The document is assembled on the first
 * request and held, since the modules it reads cannot change under a running
 * server.
 */
export function openApiEndpoint(input: {
	path: string;
	options: OpenApiRouteOptions;
	endpoints: OpenApiEndpoint[];
	/** The app's matchers, so a `[id=integer]` param documents what the matcher parses it to. */
	matchers?: ParamMatchers;
}): EndpointRoute {
	let document: Promise<string> | undefined;
	const GET: RequestHandler = async () => {
		document ??= buildOpenApiDocument(input.endpoints, input.options, input.matchers).then(
			(result) => {
				for (const warning of result.warnings) console.warn(`[implement] openapi — ${warning}`);
				return JSON.stringify(result.document);
			},
		);
		return new Response(await document, {
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	};
	return {
		pattern: input.path,
		id: input.path,
		extension: null,
		file: OPENAPI_FILE,
		module: { GET },
	};
}

/** Stands in for a routes-relative file the openapi endpoint does not have. */
export const OPENAPI_FILE = "(openapi)";
