import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineDynamicEnv } from "@implementjs/kit/env";
import { kit } from "@implementjs/kit";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import adapter from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/app");
const out = join(fixture, "dist");

type Worker = {
	default: {
		fetch: (
			request: Request,
			env: Record<string, unknown>,
			context: Record<string, unknown>,
		) => Promise<Response>;
	};
};

describe("@implementjs/adapter-cloudflare", () => {
	let worker: Worker;

	beforeAll(async () => {
		await build({
			root: fixture,
			configFile: false,
			logLevel: "silent",
			plugins: [kit({ adapter: adapter() })],
		});
		// workerd has a global `caches`; node does not, and the worker reaches for
		// it to hand the app its platform
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Standing in for the workerd global the bundle closes over.
		(globalThis as { caches?: unknown }).caches ??= {};
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The worker's default export is the module-worker contract.
		worker = (await import(pathToFileURL(join(out, "_worker.js")).href)) as Worker;
	}, 180_000);

	afterAll(() => {
		rmSync(out, { recursive: true, force: true });
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("writes the assets and the worker beside them", () => {
		expect(existsSync(join(out, "_worker.js"))).toBe(true);
		expect(existsSync(join(out, "index.html"))).toBe(true);
		expect(existsSync(join(out, "pinned/index.html"))).toBe(true);
		expect(existsSync(join(out, "hello.txt"))).toBe(true);
	});

	it("keeps the worker out of requests the assets answer", () => {
		const routes: { version: number; include: string[]; exclude: string[] } = JSON.parse(
			readFileSync(join(out, "_routes.json"), "utf8"),
		);
		expect(routes).toEqual({
			version: 1,
			include: ["/*"],
			exclude: ["/assets/*", "/_worker.js"],
		});
	});

	it("bundles to a single module, because a worker is one upload", () => {
		const bundled = readFileSync(join(out, "_worker.js"), "utf8");
		expect(bundled).not.toMatch(/^import .* from "(?!node:)/m);
		expect(existsSync(join(out, "chunks"))).toBe(false);
	});

	it("points kit's dynamic env at the bindings the request arrived with", async () => {
		// a worker has no `process.env`, so this is the only place `env.dynamic.server.ts`
		// can get its values — and the slot is shared, so a separate copy of kit sees it
		await worker.default.fetch(
			new Request("https://example.com/"),
			{ WORKER_TOKEN: "from-binding" },
			{},
		);
		const env = defineDynamicEnv({
			WORKER_TOKEN: {
				"~standard": {
					version: 1,
					vendor: "kit-tests",
					validate: (value) =>
						typeof value === "string" ? { value } : { issues: [{ message: "expected a string" }] },
				},
			},
		});
		expect(env.WORKER_TOKEN).toBe("from-binding");
	});

	it("renders pages and serves endpoints", async () => {
		const page = await worker.default.fetch(
			new Request("https://example.com/dynamic", { headers: { "x-user": "ada" } }),
			{},
			{},
		);
		expect(page.status).toBe(200);
		expect(page.headers.get("x-route-id")).toBe("/dynamic");
		expect(await page.text()).toContain("hello ada");

		const posted = await worker.default.fetch(
			new Request("https://example.com/api", {
				method: "POST",
				body: JSON.stringify({ hello: "world" }),
				headers: { "content-type": "application/json", "x-user": "ada" },
			}),
			{},
			{},
		);
		expect(await posted.json()).toEqual({ echoed: { hello: "world" }, user: "ada" });
	});

	it("lets the assets binding answer first", async () => {
		const asset = new Response("from the assets", { status: 200 });
		const env = { ASSETS: { fetch: () => Promise.resolve(asset) } };
		const response = await worker.default.fetch(new Request("https://example.com/pinned"), env, {});
		expect(await response.text()).toBe("from the assets");
	});

	it("hands the app the worker's env and context", async () => {
		const env = { DB: "a binding" };
		const context = { waitUntil: () => {} };
		const response = await worker.default.fetch(
			new Request("https://example.com/api"),
			env,
			context,
		);
		expect(response.status).toBe(200);
	});
});
