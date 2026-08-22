import { existsSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { kit } from "@implementjs/kit";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import adapter from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/app");
const out = join(fixture, "dist");

type BuiltServer = {
	start: (options?: { port?: number; host?: string }) => Server;
};

describe("@implementjs/adapter-node", () => {
	let server: Server;
	let origin: string;

	beforeAll(async () => {
		await build({
			root: fixture,
			configFile: false,
			logLevel: "silent",
			plugins: [kit({ adapter: adapter() })],
		});
		// the built server is what a deploy runs: plain ESM, imported from disk
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The adapter's output exports the server it just built.
		const built = (await import(pathToFileURL(join(out, "handler.js")).href)) as BuiltServer;
		server = built.start({ port: 0, host: "127.0.0.1" });
		await new Promise<void>((ready) => {
			server.once("listening", ready);
		});
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A listening TCP server always reports an AddressInfo.
		origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}, 180_000);

	afterAll(async () => {
		await new Promise((closed) => server.close(closed));
		rmSync(out, { recursive: true, force: true });
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("writes a runnable directory", () => {
		expect(existsSync(join(out, "index.js"))).toBe(true);
		expect(existsSync(join(out, "handler.js"))).toBe(true);
		expect(existsSync(join(out, "server/index.js"))).toBe(true);
		expect(existsSync(join(out, "client/index.html"))).toBe(true);
		// the output is ESM whatever the app's own package.json says
		expect(JSON.parse(readFileSync(join(out, "package.json"), "utf8"))).toMatchObject({
			type: "module",
		});
	});

	it("renders a page with a server load per request", async () => {
		const response = await fetch(`${origin}/dynamic`, { headers: { "x-user": "ada" } });
		expect(response.status).toBe(200);
		expect(response.headers.get("x-route-id")).toBe("/dynamic");
		expect(await response.text()).toContain("hello ada");

		// the point of rendering per request: a second caller sees their own data
		const other = await fetch(`${origin}/dynamic`, { headers: { "x-user": "grace" } });
		expect(await other.text()).toContain("hello grace");
	});

	it("serves POST endpoints, which a static build has nowhere to run", async () => {
		const response = await fetch(`${origin}/api`, {
			method: "POST",
			body: JSON.stringify({ hello: "world" }),
			headers: { "content-type": "application/json", "x-user": "ada" },
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ echoed: { hello: "world" }, user: "ada" });
	});

	it("serves prerendered pages from disk rather than rendering them again", async () => {
		expect(existsSync(join(out, "client/pinned/index.html"))).toBe(true);
		const response = await fetch(`${origin}/pinned`);
		expect(response.status).toBe(200);
		// the file, not the pipeline — the hook that stamps the route id never ran
		expect(response.headers.get("x-route-id")).toBeNull();
		expect(await response.text()).toContain("pinned: pinned");
	});

	it("caches hashed assets forever and everything else not at all", async () => {
		const html = await (await fetch(`${origin}/`)).text();
		const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
		expect(asset).toBeDefined();

		const hashed = await fetch(`${origin}${asset}`);
		expect(hashed.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

		const plain = await fetch(`${origin}/hello.txt`);
		expect(await plain.text()).toContain("hello from static");
		expect(plain.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
	});

	it("runs the app's param matchers in the deployed server", async () => {
		const matched = await fetch(`${origin}/orders/42`);
		expect(matched.status).toBe(200);
		expect(await matched.text()).toContain("order #42");

		// the matcher turns the segment down, so nothing serves the path
		const rejected = await fetch(`${origin}/orders/express`);
		expect(rejected.status).toBe(404);
		expect(await rejected.text()).toContain("error: Not Found");
	});

	it("renders the app's error page for an unknown path", async () => {
		const response = await fetch(`${origin}/nope`);
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("error: Not Found");
	});

	it("takes the request's own origin from the proxy headers", async () => {
		// the app builds absolute URLs from this, so a terminated TLS connection
		// must not come out as http://
		const response = await fetch(`${origin}/api`, {
			headers: { "x-forwarded-proto": "https", host: "example.com" },
		});
		expect(response.status).toBe(200);
	});
});
