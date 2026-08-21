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

	beforeAll(async () => {
		const logger = createLogger("error");
		logger.error = (message) => logged.push(message);
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
