import { readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { RenderToStringResult } from "@implementjs/core/server";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kit } from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/basic");

describe("kit plugin (dev SSR through the generated entries)", () => {
	let server: ViteDevServer;
	let render: (url: string) => RenderToStringResult;

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

	it("renders the root page through the root layout", () => {
		const { html } = render("/");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain("<h1>home</h1>");
	});

	it("renders nested static pages", () => {
		expect(render("/docs").html).toContain("<p>docs home</p>");
	});

	it("renders catch-all params joined with slashes", () => {
		expect(render("/docs/guide/install").html).toContain("<p>guide/install</p>");
	});

	it("renders [param] pages", () => {
		expect(render("/users/42").html).toContain("<p>user 42</p>");
	});

	it("renders the error page for unmatched paths", () => {
		expect(render("/nope/nope").html).toContain("<p>not found</p>");
	});

	it("renders (group) routes without the group in the path", () => {
		const { html } = render("/dashboard");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain('<div class="authed">');
		expect(html).toContain("<p>dashboard</p>");
	});

	it("skips intermediate layouts for an index@ reset page", () => {
		const { html } = render("/dashboard/print");
		expect(html).toContain('<main class="shell">');
		expect(html).toContain("<p>print view</p>");
		expect(html).not.toContain('class="authed"');
	});

	it("resolves @/lib imports to src/lib", () => {
		expect(render("/lib-alias").html).toContain("<p>hello from lib</p>");
	});

	it("resolves aliases from the alias option, in Vite and the generated tsconfig", () => {
		expect(render("/custom-alias").html).toContain("<p>custom alias says: hello from lib</p>");
		const tsconfig = JSON.parse(
			readFileSync(join(fixture, ".implement/tsconfig.json"), "utf8"),
		) as { compilerOptions: { paths: Record<string, string[]> } };
		expect(tsconfig.compilerOptions.paths["$lib/*"]).toEqual(["../src/lib/*"]);
		expect(tsconfig.compilerOptions.paths["@/lib/*"]).toEqual(["../src/lib/*"]);
	});

	it("serves static files from static/ by default", async () => {
		expect(server.config.publicDir).toBe(join(fixture, "static"));
		const listener = createHttpServer(server.middlewares);
		await new Promise<void>((done) => listener.listen(0, done));
		try {
			const { port } = listener.address() as AddressInfo;
			const response = await fetch(`http://localhost:${port}/hello.txt`);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("static hello\n");
		} finally {
			await new Promise((done) => listener.close(done));
		}
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
