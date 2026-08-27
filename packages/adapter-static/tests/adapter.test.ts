import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { kit, type KitOptions } from "@implementjs/kit";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import type { Builder } from "@implementjs/kit/adapter";
import adapter, { type StaticAdapterOptions } from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/app");

async function buildApp(
	options: StaticAdapterOptions = {},
	kitOptions: KitOptions = {},
): Promise<void> {
	await build({
		root: fixture,
		configFile: false,
		logLevel: "silent",
		plugins: [kit({ adapter: adapter(options), ...kitOptions })],
	});
}

function cleanup(...dirs: string[]): void {
	for (const dir of [".implement", "dist", ...dirs]) {
		rmSync(join(fixture, dir), { recursive: true, force: true });
	}
}

describe("@implementjs/adapter-static", () => {
	afterEach(() => {
		cleanup("pages", "assets", "spa");
	});

	it("writes every page as a file", async () => {
		await buildApp();
		const dist = join(fixture, "dist");
		expect(readFileSync(join(dist, "index.html"), "utf8")).toContain("home");
		expect(readFileSync(join(dist, "pinned/index.html"), "utf8")).toContain("pinned: pinned");
		// a load with no request behind it runs once, at build time
		expect(readFileSync(join(dist, "dynamic/index.html"), "utf8")).toContain("hello anonymous");
		// GET endpoints become files too, which is the only way they ship
		expect(JSON.parse(readFileSync(join(dist, "api"), "utf8"))).toEqual({ ok: true });
		// what a static host answers unknown paths with
		expect(existsSync(join(dist, "404.html"))).toBe(true);
		expect(readFileSync(join(dist, "hello.txt"), "utf8")).toContain("hello from static");
	}, 180_000);

	it("splits documents from assets when asked", async () => {
		await buildApp({ pages: "pages", assets: "assets" });
		expect(existsSync(join(fixture, "pages/index.html"))).toBe(true);
		expect(existsSync(join(fixture, "pages/assets"))).toBe(false);
		expect(existsSync(join(fixture, "assets/index.html"))).toBe(true);
		expect(existsSync(join(fixture, "assets/hello.txt"))).toBe(true);
	}, 180_000);

	it("writes an unrendered shell for a single-page app", async () => {
		await buildApp({ pages: "spa", fallback: "index.html" }, { prerender: false });
		const shell = readFileSync(join(fixture, "spa/index.html"), "utf8");
		expect(shell).toContain("<!doctype html>");
		// nothing was rendered into it — the client router takes over
		expect(shell).not.toContain("data-ssr");
	}, 180_000);

	it("precompresses what compresses", async () => {
		await buildApp({ precompress: true });
		expect(existsSync(join(fixture, "dist/index.html.gz"))).toBe(true);
		expect(existsSync(join(fixture, "dist/index.html.br"))).toBe(true);
	}, 180_000);

	it("refuses to ship a build with routes a static host cannot answer", async () => {
		await expect(buildApp({}, { prerender: { default: false } })).rejects.toThrow(
			/nothing prerendered these[\S\s]*page \/[\S\s]*endpoint \/api/,
		);
	}, 180_000);

	it("ships it anyway when told to", async () => {
		await buildApp({ strict: false }, { prerender: { default: false } });
		expect(existsSync(join(fixture, "dist/dynamic/index.html"))).toBe(false);
		// a route that asked for it still prerenders — an explicit flag outranks
		// the default either way round
		expect(existsSync(join(fixture, "dist/pinned/index.html"))).toBe(true);
	}, 180_000);
});

/** A finished build, stubbed — enough for the checks `adapt` runs before it writes anything. */
function stubBuilder(sockets: string[]): Builder {
	return {
		root: fixture,
		outDir: join(fixture, ".implement/output"),
		clientDir: join(fixture, ".implement/output/client"),
		serverDir: join(fixture, ".implement/output/server"),
		serverEntry: "index.js",
		base: "/",
		assetsDir: "assets",
		template: "<!doctype html>",
		prerendered: { pages: [], files: [] },
		routes: { pages: [], endpoints: [], sockets, dynamic: true },
		log: { info: () => undefined, warn: () => undefined, error: () => undefined },
		rimraf: () => undefined,
		mkdirp: () => undefined,
		copy: () => [],
		writeFile: () => undefined,
	};
}

describe("a socket route", () => {
	it("is refused at build time, naming the routes and where they can go instead", () => {
		expect(() => adapter().adapt(stubBuilder(["relay/server.ts"]))).toThrow(/relay\/server\.ts/);
		expect(() => adapter().adapt(stubBuilder(["relay/server.ts"]))).toThrow(
			/@implementjs\/adapter-node/,
		);
	});
});
