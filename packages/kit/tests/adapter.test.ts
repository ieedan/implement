import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Adapter, Builder } from "../src/adapter.ts";
import { kit, type KitOptions } from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/adapter-app");
const output = join(fixture, ".implement/output");

/** An adapter that keeps what it was handed, so the tests can inspect the build. */
function recorder(settings: Partial<Adapter> = {}): { adapter: Adapter; builder: () => Builder } {
	let captured: Builder | null = null;
	return {
		adapter: {
			name: "test-adapter",
			...settings,
			adapt(builder) {
				captured = builder;
			},
		},
		builder: () => {
			if (captured === null) throw new Error("the adapter never ran");
			return captured;
		},
	};
}

async function buildWith(adapter: Adapter, options: KitOptions = {}): Promise<void> {
	await build({
		root: fixture,
		configFile: false,
		logLevel: "silent",
		plugins: [kit({ adapter, ...options })],
	});
}

describe("adapter builds", () => {
	const { adapter, builder } = recorder();

	beforeAll(async () => {
		await buildWith(adapter);
	}, 120_000);

	afterAll(() => {
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("stages the client bundle instead of writing a static site", () => {
		const client = builder().clientDir;
		expect(client).toBe(join(output, "client"));
		expect(existsSync(join(client, "index.html"))).toBe(true);
		// `static/` still lands at the site root, as it does in a static build
		expect(readFileSync(join(client, "hello.txt"), "utf8")).toContain("hello from static");
	});

	it("builds a server bundle whose entry the adapter can name", () => {
		const server = builder().serverDir;
		expect(server).toBe(join(output, "server"));
		expect(existsSync(join(server!, builder().serverEntry))).toBe(true);
	});

	it("hands the adapter the route table", () => {
		const { routes } = builder();
		expect(routes.pages).toEqual(expect.arrayContaining(["/", "/dynamic", "/pinned"]));
		expect(routes.endpoints).toEqual([{ pattern: "/api", extension: null }]);
		expect(routes.dynamic).toBe(true);
	});

	it("prerenders pages with no server load, and leaves the rest to the server", () => {
		const { prerendered, clientDir } = builder();
		expect(prerendered.pages).toContain("/");
		expect(prerendered.pages).not.toContain("/dynamic");
		expect(existsSync(join(clientDir, "dynamic/index.html"))).toBe(false);
	});

	it("prerenders a route that asks for it", () => {
		const { prerendered, clientDir } = builder();
		expect(prerendered.pages).toContain("/pinned");
		expect(readFileSync(join(clientDir, "pinned/index.html"), "utf8")).toContain("pinned: pinned");
	});

	it("writes route data only for the pages it prerendered", () => {
		const { prerendered } = builder();
		expect(prerendered.files).toContain("/pinned/__data.json");
		expect(prerendered.files).not.toContain("/dynamic/__data.json");
	});

	it("leaves GET endpoints to the server rather than freezing them", () => {
		const { prerendered, clientDir } = builder();
		expect(prerendered.files).not.toContain("/api");
		expect(existsSync(join(clientDir, "api"))).toBe(false);
	});

	it("skips the 404 shell, which only a static host would serve", () => {
		expect(existsSync(join(builder().clientDir, "404.html"))).toBe(false);
	});

	it("answers requests through the built server", async () => {
		const { serverDir, serverEntry } = builder();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The built entry exports kit's request handler.
		const { handler } = (await import(join(serverDir!, serverEntry))) as {
			handler: (request: Request) => Promise<Response>;
		};

		const page = await handler(
			new Request("https://example.com/dynamic", { headers: { "x-user": "ada" } }),
		);
		expect(page.status).toBe(200);
		expect(page.headers.get("x-route-id")).toBe("/dynamic");
		const html = await page.text();
		expect(html).toContain("hello ada");
		// the built shell, not a bare render
		expect(html).toContain("<!doctype html>");
		// the route's own chunk is preloaded, which only the client manifest knows
		expect(html).toMatch(/<link rel="modulepreload" crossorigin href="\/assets\/[^"]+\.js">/);

		const posted = await handler(
			new Request("https://example.com/api", {
				method: "POST",
				body: JSON.stringify({ hello: "world" }),
				headers: { "content-type": "application/json", "x-user": "ada" },
			}),
		);
		expect(posted.status).toBe(200);
		expect(await posted.json()).toEqual({ echoed: { hello: "world" }, user: "ada" });

		const missing = await handler(new Request("https://example.com/nope"));
		expect(missing.status).toBe(404);
		expect(await missing.text()).toContain("error: Not Found");
	});
});

describe("prerender.default", () => {
	const { adapter, builder } = recorder();

	beforeAll(async () => {
		await buildWith(adapter, { prerender: { default: true } });
	}, 120_000);

	afterAll(() => {
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("prerenders everything the app has when the config says so", () => {
		const { prerendered } = builder();
		expect(prerendered.pages).toEqual(expect.arrayContaining(["/", "/dynamic", "/pinned"]));
		expect(prerendered.files).toContain("/api");
	});
});

describe("a root the server renders", () => {
	const { adapter, builder } = recorder();

	beforeAll(async () => {
		await buildWith(adapter, { prerender: { default: false } });
	}, 120_000);

	afterAll(() => {
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("drops the shell, which a host would otherwise serve as the front page", () => {
		expect(builder().prerendered.pages).not.toContain("/");
		expect(existsSync(join(builder().clientDir, "index.html"))).toBe(false);
		// the server still has it, and so does every adapter
		expect(builder().template).toContain("<!doctype html>");
	});

	it("keeps a route that asked to prerender", () => {
		expect(builder().prerendered.pages).toContain("/pinned");
		expect(existsSync(join(builder().clientDir, "pinned/index.html"))).toBe(true);
	});
});

describe("an adapter that ships no server", () => {
	const { adapter, builder } = recorder({ server: false });

	beforeAll(async () => {
		await buildWith(adapter);
	}, 120_000);

	afterAll(() => {
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("skips the server build and prerenders everything", () => {
		expect(builder().serverDir).toBeNull();
		expect(existsSync(join(output, "server"))).toBe(false);
		expect(builder().prerendered.pages).toEqual(
			expect.arrayContaining(["/", "/dynamic", "/pinned"]),
		);
	});

	it("still writes the 404 shell a static host needs", () => {
		expect(existsSync(join(builder().clientDir, "404.html"))).toBe(true);
	});
});

describe("the OpenAPI document with prerendering off", () => {
	const { adapter, builder } = recorder();
	const document = join(fixture, "static/openapi.json");

	beforeAll(async () => {
		rmSync(document, { force: true });
		await buildWith(adapter, {
			prerender: false,
			api: {
				openapi: {
					info: { title: "Adapter API", version: "1.0.0" },
					output: "static/openapi.json",
				},
			},
		});
	}, 120_000);

	afterAll(() => {
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
		rmSync(document, { force: true });
	});

	it("writes `output` from a build that prerenders nothing at all", () => {
		expect(builder().prerendered.pages).toEqual([]);
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading back the document the build just wrote.
		const { paths } = JSON.parse(readFileSync(document, "utf8")) as {
			paths: Record<string, unknown>;
		};
		expect(Object.keys(paths)).toEqual(["/api"]);
	});

	it("ships it with the build that produced it, and names it to the adapter", () => {
		expect(readFileSync(join(builder().clientDir, "openapi.json"), "utf8")).toContain('"/api"');
		expect(builder().prerendered.files).toContain("/openapi.json");
	});
});

/**
 * The bug this guards: an MCP route converts its tools' input schemas at
 * runtime, through the vendor's own converter package. Reached by a variable
 * specifier that was the point of, the converter is invisible to the bundler
 * and never ships — and a bundling adapter's output has no `node_modules` to
 * fall back on, so every tool went out as an unconstrained `{"type":"object"}`
 * that the model could see but never call correctly. Locally it all looked
 * right, because dev resolves the package from disk.
 */
describe("an MCP route in a bundled server", () => {
	const mcpFixture = join(import.meta.dirname, "fixtures/mcp-app");
	const { adapter, builder } = recorder({ build: { bundle: true } });
	let bundled: string;

	beforeAll(async () => {
		await build({
			root: mcpFixture,
			configFile: false,
			logLevel: "silent",
			plugins: [kit({ adapter })],
		});
		const { serverDir, serverEntry } = builder();
		bundled = readFileSync(join(serverDir!, serverEntry), "utf8");
	}, 120_000);

	afterAll(() => {
		rmSync(join(mcpFixture, ".implement"), { recursive: true, force: true });
	});

	it("bundles the converter instead of leaving a specifier nothing can resolve", () => {
		// a string only `@valibot/to-json-schema` emits — the converter's own code,
		// in the one file the adapter deploys
		expect(bundled).toContain("cannot be converted to JSON Schema");
		expect(bundled).not.toMatch(/from\s*["']@valibot\/to-json-schema["']/);
	});

	it("lists every tool's arguments through the built server", async () => {
		const { serverDir, serverEntry } = builder();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The built entry exports kit's request handler.
		const { handler } = (await import(join(serverDir!, serverEntry))) as {
			handler: (request: Request) => Promise<Response>;
		};
		const response = await handler(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
			}),
		);
		expect(response.status).toBe(200);
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading a JSON-RPC envelope back out of the response.
		const { result } = (await response.json()) as {
			result: { tools: { name: string; inputSchema: Record<string, unknown> }[] };
		};
		expect(result.tools).toHaveLength(1);
		expect(result.tools[0]).toMatchObject({
			name: "create_issue",
			inputSchema: {
				type: "object",
				properties: { title: { type: "string" }, labels: { type: "array" } },
				required: ["title"],
			},
		});
	});
});
