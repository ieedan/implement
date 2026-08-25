import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { RenderToStringResult } from "@implementjs/core/server";
import { createLogger, createServer, type ViteDevServer } from "vite";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and dynamic module loading require intentional narrowing. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prerenderServerFiles } from "../src/dev.ts";
import { kit } from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/basic");

type RenderResult = RenderToStringResult & { data?: Record<string, unknown> };

describe("kit plugin (dev SSR through the generated entries)", () => {
	let server: ViteDevServer;
	let render: (url: string) => Promise<RenderResult>;
	/** What the dev server printed — the terminal a developer would be watching. */
	const logged: string[] = [];
	/** The same terminal, for the lines kit writes as warnings rather than errors. */
	const warned: string[] = [];

	beforeAll(async () => {
		const logger = createLogger("error");
		logger.error = (message) => logged.push(message);
		logger.warn = (message) => warned.push(message);
		server = await createServer({
			root: fixture,
			configFile: false,
			logLevel: "error",
			customLogger: logger,
			server: { middlewareMode: true, watch: null },
			plugins: [kit({ alias: { $lib: "src/lib" } })],
		});
		const entry = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: typeof render;
		};
		render = entry.render;
	});

	afterAll(async () => {
		await server.close();
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	/** Serve the dev middlewares over a real socket for fetch-level tests. */
	async function withListener<T>(fn: (origin: string) => Promise<T>): Promise<T> {
		const listener: Server = createHttpServer(server.middlewares);
		await new Promise<void>((done) => listener.listen(0, done));
		try {
			const { port } = listener.address() as AddressInfo;
			return await fn(`http://localhost:${port}`);
		} finally {
			await new Promise((done) => listener.close(done));
		}
	}

	it("renders the root page through the root layout", async () => {
		const { html } = await render("/");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain("<h1>home</h1>");
	});

	it("renders nested static pages", async () => {
		expect((await render("/docs")).html).toContain("<p>docs home</p>");
	});

	it("renders catch-all params joined with slashes", async () => {
		expect((await render("/docs/guide/install")).html).toContain("<p>guide/install</p>");
	});

	it("renders [param] pages", async () => {
		expect((await render("/users/42")).html).toContain("<p>user 42</p>");
	});

	it("renders the error page for unmatched paths", async () => {
		expect((await render("/nope/nope")).html).toContain("<p>not found</p>");
	});

	it("renders (group) routes without the group in the path", async () => {
		const { html } = await render("/dashboard");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain('<div class="authed">');
		expect(html).toContain("<p>dashboard</p>");
	});

	it("skips intermediate layouts for a page@ reset page", async () => {
		const { html } = await render("/dashboard/print");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain("<p>print view</p>");
		expect(html).not.toContain('class="authed"');
	});

	it("hoists a layout@ subtree out of the layouts it resets past", async () => {
		const { html } = await render("/admin");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain('<div class="admin">');
		expect(html).toContain("<p>admin</p>");
		expect(html).not.toContain('class="authed"');
	});

	it("resets a page@<segment> page to that ancestor's layout, keeping its params", async () => {
		const nested = await render("/shop/42");
		expect(nested.html).toContain('<div class="shop">');
		expect(nested.html).toContain('<div class="product">');
		expect(nested.html).toContain("<p>product 42</p>");

		const { html } = await render("/shop/42/checkout");
		// the reset stops at shop, so shop's layout still wraps it and [id]'s does not
		expect(html).toContain('<main class="shell">');
		expect(html).toContain('<div class="shop">');
		expect(html).not.toContain('class="product"');
		expect(html).toContain("<p>checkout 42</p>");
	});

	it("resolves @/lib imports to src/lib", async () => {
		expect((await render("/lib-alias")).html).toContain("<p>hello from lib</p>");
	});

	it("resolves aliases from the alias option, in Vite and the generated tsconfig", async () => {
		expect((await render("/custom-alias")).html).toContain(
			"<p>custom alias says: hello from lib</p>",
		);
		const tsconfig = JSON.parse(
			readFileSync(join(fixture, ".implement/tsconfig.json"), "utf8"),
		) as { compilerOptions: { paths: Record<string, string[]> } };
		expect(tsconfig.compilerOptions.paths["$lib/*"]).toEqual(["../src/lib/*"]);
		expect(tsconfig.compilerOptions.paths["@/lib/*"]).toEqual(["../src/lib/*"]);
	});

	it("runs the load chain into the render and returns the data", async () => {
		const result = await render("/data-page");
		expect(result.html).toContain("<p>layout-data / loaded /data-page</p>");
		expect(result.data).toEqual({
			"data-page/layout.server.ts": { shared: "layout-data" },
			"data-page/page.server.ts": { message: "loaded /data-page" },
		});
	});

	it("gives a load its parent layouts' data, two levels up", async () => {
		const result = await render("/parent-chain/deep");
		expect(result.data).toEqual({
			"parent-chain/layout.server.ts": { workspace: "acme", member: true },
			"parent-chain/deep/layout.server.ts": { section: "acme/deep" },
			"parent-chain/deep/page.server.ts": { title: "acme/deep in acme" },
		});
		expect(result.html).toContain("<p>acme/deep in acme</p>");
	});

	it("writes a $types typing parent() as the chain above the load", () => {
		const types = readFileSync(
			join(fixture, ".implement/types/src/routes/parent-chain/deep/$types.d.ts"),
			"utf8",
		);
		expect(types).toContain("export type LoadEvent = KitLoadEvent<ServerParams, PageParentData>;");
		expect(types).toContain(
			"export type LayoutLoadEvent = KitLoadEvent<ServerParams, LayoutParentData>;",
		);
		// the layout's own load is not its own parent; the page's is both layouts
		expect(types).toContain(
			'export type LayoutParentData = Merge<{}, LoadData<typeof import("../../parent-chain/layout.server.ts").default>>;',
		);
		expect(types).toContain(
			'export type PageParentData = Merge<Merge<{}, LoadData<typeof import("../../parent-chain/layout.server.ts").default>>, LoadData<typeof import("../../parent-chain/deep/layout.server.ts").default>>;',
		);
	});

	it("resolves $implement/navigation to the invalidation helpers", async () => {
		const navigation = (await server.ssrLoadModule("$implement/navigation")) as {
			invalidate: unknown;
			invalidateAll: unknown;
		};
		expect(typeof navigation.invalidate).toBe("function");
		expect(typeof navigation.invalidateAll).toBe("function");
	});

	it("returns no data for routes without loads", async () => {
		expect((await render("/docs")).data).toBeUndefined();
	});

	it("serves __data.json for load-bearing routes", async () => {
		await withListener(async (origin) => {
			const response = await fetch(`${origin}/data-page/__data.json`);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("application/json");
			expect(await response.json()).toEqual({
				"data-page/layout.server.ts": { shared: "layout-data" },
				"data-page/page.server.ts": { message: "loaded /data-page" },
			});
			const missing = await fetch(`${origin}/docs/__data.json`);
			expect(missing.status).toBe(404);
		});
	});

	it("serves extension endpoints at the parent path plus extension", async () => {
		await withListener(async (origin) => {
			const response = await fetch(`${origin}/docs/guide/install.md`);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("text/markdown");
			expect(await response.text()).toBe("# guide/install\n");
		});
	});

	it("dispatches endpoint methods and rejects the rest with a 405", async () => {
		await withListener(async (origin) => {
			const response = await fetch(`${origin}/api`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "kit" }),
			});
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ hello: "kit" });

			const rejected = await fetch(`${origin}/api`);
			expect(rejected.status).toBe(405);
			expect(rejected.headers.get("allow")).toBe("POST");
		});
	});

	it("runs a route's param matcher, and hands the handler what it parsed", async () => {
		await withListener(async (origin) => {
			const matched = await fetch(`${origin}/orders/21`);
			expect(matched.status).toBe(200);
			// the matcher parsed the segment, so the handler multiplied a number
			expect(await matched.json()).toEqual({ id: 21, doubled: 42 });

			// a segment the matcher turns down falls through to the plain route
			const fellThrough = await fetch(`${origin}/orders/express`);
			expect(await fellThrough.json()).toEqual({ slug: "express" });
		});
	});

	it("writes a $types typing a matched param by what its matcher produces", () => {
		const types = readFileSync(
			join(fixture, ".implement/types/src/routes/orders/[id=integer]/$types.d.ts"),
			"utf8",
		);
		expect(types).toContain(
			'export type ServerParams = { "id": import("@implementjs/kit/params").ParamType<typeof import("../../../../src/params/integer.ts").default> };',
		);
		// the matchers reach the router through its own registry, from a file of
		// their own: a module, so this augments `@implementjs/router` instead of
		// replacing it the way the script beside it would
		const augmentation = readFileSync(
			join(fixture, ".implement/types/$implement-params.d.ts"),
			"utf8",
		);
		expect(augmentation).toContain('import type {} from "@implementjs/router";');
		expect(augmentation).toContain('declare module "@implementjs/router" {');
		expect(augmentation).toContain(
			'"integer": import("@implementjs/kit/params").ParamType<typeof import("./src/params/integer.ts").default>;',
		);
	});

	it("runs hooks.server.ts around every request", async () => {
		await withListener(async (origin) => {
			// the page render, with the hook's transformPageChunk applied to the document
			const page = await fetch(`${origin}/locals`, { headers: { "x-user": "ada" } });
			expect(page.status).toBe(200);
			expect(page.headers.get("x-route-id")).toBe("/locals");
			expect(page.headers.get("x-data-request")).toBe("false");
			const html = await page.text();
			expect(html).toContain("<p>hello ada</p>");
			expect(html).toContain('<meta name="stamped" />');

			// the same locals reach the route's load through __data.json
			const data = await fetch(`${origin}/locals/__data.json`, { headers: { "x-user": "grace" } });
			expect(data.headers.get("x-data-request")).toBe("true");
			expect(await data.json()).toEqual({ "locals/page.server.ts": { user: "grace" } });

			// and an endpoint handler
			const endpoint = await fetch(`${origin}/whoami`, { headers: { "x-user": "ada" } });
			expect(await endpoint.json()).toEqual({ user: "ada", routeId: "/whoami" });
		});
	});

	it("lets a hook answer a request itself, without rendering the route", async () => {
		await withListener(async (origin) => {
			const blocked = await fetch(`${origin}/private`);
			expect(blocked.status).toBe(401);
			expect(await blocked.text()).toBe("nope");

			const allowed = await fetch(`${origin}/private`, { headers: { "x-user": "ada" } });
			expect(allowed.status).toBe(200);
			expect(await allowed.text()).toContain("<p>secret</p>");
		});
	});

	it("renders the error page with a 404 for an unmatched path", async () => {
		await withListener(async (origin) => {
			const response = await fetch(`${origin}/nope`, { headers: { accept: "text/html" } });
			expect(response.status).toBe(404);
			expect(await response.text()).toContain("<p>not found</p>");
		});
	});

	it("warns about a routes file whose name only just misses a routing one", () => {
		// the fixture has a `misnamed/+server.ts`, which routes nothing at all —
		// without this line the endpoint just silently never answers
		const warning = warned.find((message) => message.includes("unknown file"));
		expect(warning).toBeDefined();
		expect(warning).toContain('unknown file "src/routes/misnamed/+server.ts"');
		expect(warning).toContain('did you mean "server.ts"?');
		// kit's own line, not the dev server's
		expect(warning).toContain("[implement]");
		expect(warning).not.toContain("[vite]");
		// and it is said once, not once per scan
		expect(warned.filter((message) => message.includes("unknown file"))).toHaveLength(1);
	});

	it("prints a server error to the dev log, with the file it came from", async () => {
		await withListener(async (origin) => {
			logged.length = 0;
			const page = await fetch(`${origin}/boom`, { headers: { accept: "text/html" } });
			expect(page.status).toBe(500);
			// the browser only gets the app's error page, so the terminal has to say it all
			expect(await page.text()).toContain("<p>not found</p>");
			expect(logged).toHaveLength(1);
			// kit's own line, not the dev server's — vite tags the ones it writes
			expect(logged[0]).toContain("[implement] GET /boom → 500");
			expect(logged[0]).not.toContain("[vite]");
			expect(logged[0]).toContain("GET /boom → 500 — load in src/routes/boom/page.server.ts");
			expect(logged[0]).toContain("Error: load blew up");
			// the app's own frames, relative to the root, without kit's pipeline
			expect(logged[0]).toContain("at readThing (src/routes/boom/page.server.ts:");
			expect(logged[0]).not.toContain("/packages/kit/src/");

			logged.length = 0;
			const data = await fetch(`${origin}/boom/__data.json`);
			expect(data.status).toBe(500);
			expect(logged[0]).toContain(
				"GET /boom (__data.json) → 500 — load in src/routes/boom/page.server.ts",
			);

			logged.length = 0;
			const endpoint = await fetch(`${origin}/boom-endpoint`);
			expect(endpoint.status).toBe(500);
			expect(logged[0]).toContain(
				"GET /boom-endpoint → 500 — GET handler in src/routes/boom-endpoint/server.ts",
			);
			expect(logged[0]).toContain("Error: endpoint blew up");
		});
	});

	it("prints a server error the build hits while writing route data", async () => {
		const errors: string[] = [];
		const outDir = join(fixture, "dist-test");
		try {
			await prerenderServerFiles({
				routes: ["/data-page", "/boom"],
				outDir,
				load: (id) => server.ssrLoadModule(id) as Promise<Record<string, unknown>>,
				entry: "/.implement/entry-server.ts",
				hasLoads: true,
				serverRoutes: [],
				logger: { info: () => {}, warn: () => {}, error: (message) => errors.push(message) },
				source: { root: fixture, routes: "src/routes" },
			});
			// the healthy route is written; the broken one says why instead of
			// leaving one payload fewer behind
			expect(readFileSync(join(outDir, "data-page/__data.json"), "utf8")).toContain("layout-data");
			expect(existsSync(join(outDir, "boom/__data.json"))).toBe(false);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("[implement] GET /boom");
			expect(errors[0]).toContain(
				"GET /boom (__data.json) → 500 — load in src/routes/boom/page.server.ts",
			);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});

	it("serves static files from static/ by default", async () => {
		expect(server.config.publicDir).toBe(join(fixture, "static"));
		await withListener(async (origin) => {
			const response = await fetch(`${origin}/hello.txt`);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("static hello\n");
		});
	});

	it("resolves ./$types to a real module, so `handler` is importable", async () => {
		const types = (await server.ssrLoadModule("/src/routes/posts/[id]/server.ts")) as {
			GET: unknown;
			PATCH: unknown;
			HEAD: unknown;
		};
		expect(typeof types.GET).toBe("function");
		expect(typeof types.PATCH).toBe("function");
		// a plain handler in the same file is untouched
		expect(typeof types.HEAD).toBe("function");
	});

	it("validates a wrapped endpoint's query and body through the real pipeline", async () => {
		await withListener(async (origin) => {
			const ok = await fetch(`${origin}/posts/7?draft=true`);
			expect(ok.status).toBe(200);
			expect(await ok.json()).toEqual({ id: "7", draft: true });

			const bad = await fetch(`${origin}/posts/7?draft=maybe`);
			expect(bad.status).toBe(400);
			expect(((await bad.json()) as { message: string }).message).toContain("invalid query");

			const patched = await fetch(`${origin}/posts/7`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: "hi" }),
			});
			expect(await patched.json()).toEqual({ id: 7, title: "hi" });

			const rejected = await fetch(`${origin}/posts/7`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: 3 }),
			});
			expect(rejected.status).toBe(400);

			// the 405/Allow computation still sees every method the file exports
			const wrong = await fetch(`${origin}/posts/7`, { method: "DELETE" });
			expect(wrong.status).toBe(405);
			expect(wrong.headers.get("allow")).toBe("GET, PATCH, HEAD");
		});
	});

	it("runs event.api in-process — a load reaches its own endpoint with no socket", async () => {
		// nothing is listening here: `render` goes straight through the pipeline,
		// so a client that opened a connection would fail rather than answer
		const { data } = await render("/api-load");
		expect(data?.["api-load/page.server.ts"]).toEqual({
			post: { id: "7", draft: true },
			failure: null,
		});
	});

	it("generates a client module keyed by the URLs the endpoints serve", async () => {
		const generated = readFileSync(join(fixture, ".implement/client.ts"), "utf8");
		expect(generated).toContain('"/posts/[id]": {');
		expect(generated).toContain('params: { "id": string };');
		expect(generated).toContain(
			'operations: Operations<typeof import("../src/routes/posts/[id]/server.ts")>;',
		);
		// type-only, so nothing here reaches a bundle at runtime
		const client = (await server.ssrLoadModule("/.implement/client.ts")) as {
			api: unknown;
			createClient: (options: { baseUrl: string }) => Record<string, unknown>;
		};
		expect(typeof client.createClient).toBe("function");
		await withListener(async (origin) => {
			const api = client.createClient({ baseUrl: origin }) as {
				GET: (
					path: string,
					options: Record<string, unknown>,
				) => Promise<{ data: unknown; error: unknown }>;
			};
			const { data, error } = await api.GET("/posts/[id]", {
				params: { id: "3" },
				query: { draft: false },
			});
			expect(error).toBeUndefined();
			expect(data).toEqual({ id: "3", draft: false });
		});
	});

	it("mounts no OpenAPI document by default", async () => {
		const endpoints = (await server.ssrLoadModule("$implement/endpoints")) as {
			endpoints: { pattern: string }[];
		};
		expect(endpoints.endpoints.map((route) => route.pattern)).not.toContain("/openapi.json");
		await withListener(async (origin) => {
			expect((await fetch(`${origin}/openapi.json`)).status).toBe(404);
		});
	});

	it("serves the OpenAPI document once an app configures one", async () => {
		const documented = await createServer({
			root: fixture,
			configFile: false,
			logLevel: "error",
			server: { middlewareMode: true, watch: null },
			plugins: [
				kit({
					alias: { $lib: "src/lib" },
					api: {
						openapi: {
							info: { title: "Fixture API", version: "1.0.0" },
							output: "static/spec/api.json",
							path: "/openapi.json",
						},
					},
				}),
			],
		});
		const listener: Server = createHttpServer(documented.middlewares);
		await new Promise<void>((done) => listener.listen(0, done));
		try {
			const { port } = listener.address() as AddressInfo;
			const origin = `http://localhost:${port}`;
			// the live route, mounted through the endpoints table
			const live = (await (await fetch(`${origin}/openapi.json`)).json()) as {
				openapi: string;
				paths: Record<string, Record<string, { parameters: unknown[] }>>;
			};
			expect(live.openapi).toBe("3.1.0");
			expect(live.paths["/posts/{id}"]?.["get"]?.parameters).toEqual([
				{ name: "id", in: "path", required: true, schema: { type: "string" } },
				{
					name: "draft",
					in: "query",
					required: false,
					schema: { type: "string", enum: ["true", "false"], default: "false" },
				},
			]);
			// a matcher gates which requests reach the route, which is no part of
			// the URL — and the param is documented as what the matcher parses it to
			expect(Object.keys(live.paths)).toContain("/orders/{id}");
			expect(Object.keys(live.paths)).not.toContain("/orders/{id=integer}");
			expect(live.paths["/orders/{id}"]?.["get"]?.parameters).toEqual([
				{ name: "id", in: "path", required: true, schema: { type: "integer" } },
			]);
			// `output` lands under static/, so its URL answers in dev too — built
			// from the routes as they are now, not from a file a build left behind
			const fromOutput = await fetch(`${origin}/spec/api.json`);
			expect(fromOutput.headers.get("content-type")).toContain("application/json");
			expect(await fromOutput.json()).toEqual(live);
		} finally {
			await new Promise((done) => listener.close(done));
			await documented.close();
		}
	});

	it("makes every page and layout a hot-update boundary in the browser copy", async () => {
		const page = await server.environments.client.transformRequest("/src/routes/docs/page.ts");
		expect(page?.code).toContain("import.meta.hot.accept(");
		expect(page?.code).toContain('"src/routes/docs/page.ts"');
		expect(page?.code).toContain("hotReplaceRoute as __implementHotReplaceRoute");

		const layout = await server.environments.client.transformRequest("/src/routes/layout.ts");
		expect(layout?.code).toContain("import.meta.hot.accept(");
		expect(layout?.code).toContain('"src/routes/layout.ts"');
	});

	it("leaves the server graph, colocated code and the error page without one", async () => {
		// the server render has no `import.meta.hot`, and swapping a component
		// into a tree that is a string by the time it is returned means nothing
		const ssr = await server.environments.ssr.transformRequest("/src/routes/docs/page.ts");
		expect(ssr?.code).not.toContain("import.meta.hot");

		// only the files that render are handles the router asks for by id
		const colocated = await server.environments.client.transformRequest("/src/lib/greeting.ts");
		expect(colocated?.code).not.toContain("__implementHotReplaceRoute");

		const errorPage = await server.environments.client.transformRequest("/src/routes/error.ts");
		expect(errorPage?.code).not.toContain("__implementHotReplaceRoute");
	});

	it("leaves the generated client entry without one, so a miss reloads", async () => {
		const entry = await server.environments.client.transformRequest("/.implement/entry-client.ts");
		expect(entry?.code).not.toContain("import.meta.hot.accept");
	});

	it("leaves a user-configured publicDir alone", async () => {
		const custom = await createServer({
			root: fixture,
			configFile: false,
			logLevel: "error",
			server: { middlewareMode: true, watch: null },
			publicDir: "public",
			plugins: [kit()],
		});
		try {
			expect(custom.config.publicDir).toBe(join(fixture, "public"));
		} finally {
			await custom.close();
		}
	});
});
