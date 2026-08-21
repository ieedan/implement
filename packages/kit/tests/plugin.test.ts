import { readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { RenderToStringResult } from "@implementjs/core/server";
import { createServer, type ViteDevServer } from "vite";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and dynamic module loading require intentional narrowing. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kit } from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/basic");

type RenderResult = RenderToStringResult & { data?: Record<string, unknown> };

describe("kit plugin (dev SSR through the generated entries)", () => {
	let server: ViteDevServer;
	let render: (url: string) => Promise<RenderResult>;

	beforeAll(async () => {
		server = await createServer({
			root: fixture,
			configFile: false,
			logLevel: "error",
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

	it("skips intermediate layouts for an index@ reset page", async () => {
		const { html } = await render("/dashboard/print");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain("<p>print view</p>");
		expect(html).not.toContain('class="authed"');
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
			"data-page/index.server.ts": { message: "loaded /data-page" },
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
				"data-page/index.server.ts": { message: "loaded /data-page" },
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
