/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading back JSON bodies and generated output requires intentional narrowing. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as v from "valibot";
import { afterEach, describe, expect, it } from "vitest";
import {
	generateParamsModule,
	generateRouterModule,
	pageRoutes,
	serverRoutes,
} from "../src/codegen.ts";
import { comparePatterns, matchPage, matchRoutePattern, routeId } from "../src/match.ts";
import { isParamMatcher, matcher, matcherTable, mismatch } from "../src/params.ts";
import { parseSegment, scanRoutes, segmentKey } from "../src/scan.ts";
import { createKitServer } from "../src/server.ts";
import { generateRouteTypes, generateRouterDeclaration } from "../src/typegen.ts";

const integer = matcher((value) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && value.trim() !== "" ? parsed : mismatch;
});

const word = matcher(/[a-z]+/);

const matchers = { integer, word };

// ---------------------------------------------------------------------------
// The matcher primitive
// ---------------------------------------------------------------------------

describe("matcher", () => {
	it("builds one from a pattern, anchored to the whole segment", () => {
		expect(word.match("hello")).toBe("hello");
		expect(word.match("hello1")).toBe(mismatch);
		expect(word.match("a/b")).toBe(mismatch);
	});

	it("does not carry lastIndex between calls on a global pattern", () => {
		const digits = matcher(/\d+/g);
		expect(digits.match("12")).toBe("12");
		expect(digits.match("12")).toBe("12");
	});

	it("builds one from a parse function, and the value is what it returned", () => {
		expect(integer.match("42")).toBe(42);
		expect(integer.match("4.5")).toBe(mismatch);
		expect(integer.match("nope")).toBe(mismatch);
	});

	it("builds one from a standard schema, rejecting what the schema rejects", () => {
		const uuid = matcher(v.pipe(v.string(), v.uuid()));
		expect(uuid.match("0189c2e4-9b3d-7a2f-8c1e-2f0a5b6d7e8f")).toBe(
			"0189c2e4-9b3d-7a2f-8c1e-2f0a5b6d7e8f",
		);
		expect(uuid.match("nope")).toBe(mismatch);
	});

	it("takes the schema's output, so a coercing schema parses the segment", () => {
		const page = matcher(
			v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(1)),
		);
		expect(page.match("3")).toBe(3);
		expect(page.match("0")).toBe(mismatch);
	});

	it("refuses a schema that cannot answer synchronously", () => {
		const async = matcher(
			v.pipeAsync(
				v.string(),
				v.checkAsync(async () => true),
			),
		);
		expect(() => async.match("x")).toThrow(/synchronously/);
	});

	it("recognizes its own", () => {
		expect(isParamMatcher(integer)).toBe(true);
		expect(isParamMatcher({ match: () => "x" })).toBe(false);
		expect(isParamMatcher(null)).toBe(false);
	});
});

describe("matcherTable", () => {
	it("names the file when a matcher module default-exports something else", () => {
		expect(() => matcherTable({ integer: (value: string) => value }, "src/params")).toThrow(
			/src\/params\/integer\.ts must default-export a matcher\(\) — got function/,
		);
	});

	it("passes the matchers through when they are all matchers", () => {
		expect(matcherTable({ integer }, "src/params")).toEqual({ integer });
	});
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

describe("matched patterns", () => {
	it("parses a =matcher out of a route directory name", () => {
		expect(parseSegment("[id=integer]")).toEqual({
			kind: "param",
			name: "id",
			matcher: "integer",
		});
		expect(parseSegment("[...slug=word]")).toEqual({
			kind: "rest",
			name: "slug",
			matcher: "word",
		});
		expect(() => parseSegment("[id=]")).toThrow(/Invalid route directory/);
		expect(() => parseSegment("[=integer]")).toThrow(/Invalid route directory/);
	});

	it("carries the matcher into the pattern and back out as a route id", () => {
		expect(segmentKey({ kind: "param", name: "id", matcher: "integer" })).toBe("/:id=integer");
		expect(segmentKey({ kind: "rest", name: "slug", matcher: "word" })).toBe("/:...slug=word");
		expect(routeId("/posts/:id=integer")).toBe("/posts/[id=integer]");
	});

	it("binds the matcher's value rather than the raw segment", () => {
		expect(matchRoutePattern("/posts/:id=integer", "/posts/42", matchers)).toEqual({ id: 42 });
		expect(matchRoutePattern("/posts/:id=integer", "/posts/abc", matchers)).toBeNull();
	});

	it("runs a catch-all's matcher over the joined remainder", () => {
		expect(matchRoutePattern("/docs/:...slug=word", "/docs/a/b", matchers)).toBeNull();
		expect(matchRoutePattern("/docs/:...slug=word", "/docs/guide", matchers)).toEqual({
			slug: "guide",
		});
	});

	it("takes the segment as a string in structure mode", () => {
		expect(matchRoutePattern("/posts/:id=integer", "/posts/abc", "structure")).toEqual({
			id: "abc",
		});
	});

	it("says so when a pattern names a matcher nothing registered", () => {
		expect(() => matchRoutePattern("/posts/:id=integer", "/posts/42", {})).toThrow(
			/not a registered param matcher/,
		);
	});

	it("ranks a matched param above a plain one, and both below a static segment", () => {
		expect(comparePatterns("/posts/new", "/posts/:id=integer")).toBeLessThan(0);
		expect(comparePatterns("/posts/:id=integer", "/posts/:slug")).toBeLessThan(0);
		expect(comparePatterns("/posts/:slug", "/posts/:...rest=word")).toBeLessThan(0);
		expect(comparePatterns("/posts/:...rest=word", "/posts/:...rest")).toBeLessThan(0);
	});

	it("falls through to the next route when a matcher turns a path down", () => {
		const pages = [
			{ pattern: "/posts/:id=integer", id: "/posts/[id=integer]", files: [] },
			{ pattern: "/posts/:slug", id: "/posts/[slug]", files: [] },
		];
		expect(matchPage(pages, "/posts/42", matchers)?.route.id).toBe("/posts/[id=integer]");
		expect(matchPage(pages, "/posts/hello", matchers)?.route.id).toBe("/posts/[slug]");
	});
});

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

let dir: string | null = null;

/** An app with a routes directory and, optionally, matchers beside it. */
function makeApp(routes: string[], params: string[] = []): { routes: string; params: string } {
	dir = mkdtempSync(join(tmpdir(), "implement-kit-params-"));
	for (const file of routes) {
		const path = join(dir, "src/routes", file);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, "export default () => null;\n");
	}
	for (const name of params) {
		const path = join(dir, "src/params", `${name}.ts`);
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(
			path,
			'import { matcher } from "@implementjs/kit/params";\nexport default matcher(/.+/);\n',
		);
	}
	return { routes: join(dir, "src/routes"), params: join(dir, "src/params") };
}

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

describe("scanRoutes with matchers", () => {
	it("collects the params directory and carries matchers into the patterns", () => {
		const app = makeApp(["posts/[id=integer]/page.ts", "docs/[...slug]/server.ts"], ["integer"]);
		const tree = scanRoutes(app.routes, app.params);
		expect(tree.matchers).toEqual(["integer"]);
		expect(pageRoutes(tree)).toEqual([
			{ pattern: "/posts/:id=integer", params: [{ name: "id", matcher: "integer" }] },
		]);
		expect(serverRoutes(tree)[0]!.params).toEqual([{ name: "slug", matcher: null }]);
	});

	it("rejects a route naming a matcher the app does not have", () => {
		const app = makeApp(["posts/[id=integer]/page.ts"], ["word"]);
		expect(() => scanRoutes(app.routes, app.params)).toThrow(
			/names the param matcher "integer".*the ones it declares are word/s,
		);
	});

	it("says the app has none when the params directory is missing", () => {
		const app = makeApp(["posts/[id=integer]/page.ts"]);
		expect(() => scanRoutes(app.routes, app.params)).toThrow(/declares no param matchers/);
	});

	it("lets two siblings bind the same name behind different matchers", () => {
		const app = makeApp(
			["posts/[id=integer]/page.ts", "posts/[id=word]/page.ts"],
			["integer", "word"],
		);
		expect(pageRoutes(scanRoutes(app.routes, app.params)).map((route) => route.pattern)).toEqual([
			"/posts/:id=integer",
			"/posts/:id=word",
		]);
	});
});

// ---------------------------------------------------------------------------
// Codegen
// ---------------------------------------------------------------------------

describe("generateParamsModule", () => {
	it("imports every matcher and checks the table", () => {
		const app = makeApp(["posts/[id=integer]/page.ts"], ["integer", "word"]);
		const code = generateParamsModule(scanRoutes(app.routes, app.params), "/src/params");
		expect(code).toContain('import matcher_0 from "/src/params/integer.ts";');
		expect(code).toContain('import matcher_1 from "/src/params/word.ts";');
		expect(code).toContain('"integer": matcher_0,');
		expect(code).toContain('}, "src/params");');
	});

	it("is an empty table for an app with no matchers", () => {
		const app = makeApp(["page.ts"]);
		expect(generateParamsModule(scanRoutes(app.routes, app.params), "/src/params")).toBe(
			"export const matchers = {};\n",
		);
	});
});

describe("generateRouterModule with matchers", () => {
	it("hands them to the Router and registers them with the runtime", () => {
		const app = makeApp(["posts/[id=integer]/page.ts"], ["integer"]);
		const code = generateRouterModule(scanRoutes(app.routes, app.params), "/src/routes");
		expect(code).toContain('import { matchers } from "$implement/params";');
		expect(code).toContain('"/posts": {');
		expect(code).toContain('"/:id=integer": {');
		expect(code).toContain("\tmatchers,");
		expect(code).toContain("registerMatchers(matchers);");
	});

	it("leaves an app with no matchers exactly as it was", () => {
		const app = makeApp(["posts/[id]/page.ts"]);
		const code = generateRouterModule(scanRoutes(app.routes, app.params), "/src/routes");
		expect(code).not.toContain("$implement/params");
		expect(code).not.toContain("registerMatchers");
	});
});

// ---------------------------------------------------------------------------
// The generated types — the point of the whole thing
// ---------------------------------------------------------------------------

const PATHS = { routes: "src/routes", params: "src/params" };

describe("the types a matched param gets", () => {
	const node = {
		dir: "posts/[id=integer]",
		segment: { kind: "param", name: "id", matcher: "integer" } as const,
		params: [{ name: "id", matcher: "integer" }],
		page: null,
		pageResetTo: null,
		layout: null,
		layoutResetTo: null,
		pageServer: null,
		layoutServer: null,
		endpoint: "posts/[id=integer]/server.ts",
		extensions: [],
		children: [],
	};

	it("reads the type off the matcher module rather than assuming a string", () => {
		const types = generateRouteTypes(node, { layoutFiles: [], pageFiles: [] }, PATHS);
		expect(types).toContain(
			'export type ServerParams = { "id": import("@implementjs/kit/params").ParamType<typeof import("../../../../src/params/integer.ts").default> };',
		);
		expect(types).toContain(
			'export type RouteParams = { "id": Readable<import("@implementjs/kit/params").ParamType<typeof import("../../../../src/params/integer.ts").default>> };',
		);
		expect(types).toContain("export const handler: HandlerBuilder<ServerParams>;");
	});

	it("keeps an unmatched param a plain string", () => {
		const plain = { ...node, params: [{ name: "id", matcher: null }] };
		expect(generateRouteTypes(plain, { layoutFiles: [], pageFiles: [] }, PATHS)).toContain(
			'export type ServerParams = { "id": string };',
		);
	});

	it("declares the matchers' types to the router, so links and renders see them", () => {
		const declaration = generateRouterDeclaration(
			[{ pattern: "/posts/:id=integer", params: [{ name: "id", matcher: "integer" }] }],
			false,
			PATHS,
			["integer"],
		);
		expect(declaration).toContain('declare module "@implementjs/router" {');
		expect(declaration).toContain(
			'"integer": import("@implementjs/kit/params").ParamType<typeof import("./src/params/integer.ts").default>;',
		);
		expect(declaration).toContain('declare module "$implement/params"');
	});

	it("declares nothing to the router for an app with no matchers", () => {
		const declaration = generateRouterDeclaration([{ pattern: "/", params: [] }], false, PATHS, []);
		expect(declaration).not.toContain('declare module "@implementjs/router"');
	});
});

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

describe("the request pipeline", () => {
	const server = createKitServer({
		hooks: {},
		matchers,
		pages: [{ pattern: "/", id: "/", files: [] }],
		endpoints: [
			{
				pattern: "/posts/:id=integer",
				id: "/posts/[id=integer]",
				extension: null,
				file: "posts/[id=integer]/server.ts",
				module: {
					GET: (event: { params: Record<string, unknown> }) => Response.json(event.params),
				},
			},
			{
				pattern: "/posts/:slug",
				id: "/posts/[slug]",
				extension: null,
				file: "posts/[slug]/server.ts",
				module: {
					GET: (event: { params: Record<string, unknown> }) => Response.json(event.params),
				},
			},
		],
		renderPage: () => null,
	});

	const get = (path: string) => server.respond(new Request(`http://localhost${path}`));

	it("hands the handler the matcher's value, not the raw segment", async () => {
		const response = await get("/posts/42");
		expect(await response.json()).toEqual({ id: 42 });
	});

	it("passes a path its matcher turns down to the next route", async () => {
		const response = await get("/posts/hello");
		expect(await response.json()).toEqual({ slug: "hello" });
	});

	it("404s when no route is left to serve the path", async () => {
		const only = createKitServer({
			hooks: {},
			matchers,
			pages: [],
			endpoints: [
				{
					pattern: "/posts/:id=integer",
					id: "/posts/[id=integer]",
					extension: null,
					file: "posts/[id=integer]/server.ts",
					module: { GET: () => new Response("ok") },
				},
			],
			renderPage: () => null,
		});
		const response = await only.respond(new Request("http://localhost/posts/hello"));
		expect(response.status).toBe(404);
	});
});
