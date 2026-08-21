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
