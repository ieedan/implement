import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { kit } from "@implementjs/kit";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import adapter from "../src/index.ts";

const fixture = join(import.meta.dirname, "fixtures/app");
const output = join(fixture, ".vercel/output");
const fn = join(output, "functions/fn.func");

type VercelConfig = {
	version: number;
	routes: ({ src?: string; dest?: string; handle?: string; headers?: Record<string, string> } & {
		continue?: boolean;
	})[];
};

describe("@implementjs/adapter-vercel", () => {
	/** The function, served the way Vercel's Node launcher serves it. */
	let server: Server;
	let origin: string;

	beforeAll(async () => {
		await build({
			root: fixture,
			configFile: false,
			logLevel: "silent",
			plugins: [kit({ adapter: adapter({ runtime: "nodejs20.x" }) })],
		});
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The built function is a Node request listener, which is the contract.
		const built = (await import(pathToFileURL(join(fn, "index.js")).href)) as {
			default: (req: unknown, res: unknown) => void;
		};
		server = createServer(built.default);
		await new Promise<void>((ready) => {
			server.listen(0, "127.0.0.1", ready);
		});
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A listening TCP server always reports an AddressInfo.
		origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}, 180_000);

	afterAll(async () => {
		await new Promise((closed) => server.close(closed));
		rmSync(join(fixture, ".vercel"), { recursive: true, force: true });
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("writes the build output the platform expects", () => {
		expect(existsSync(join(output, "static/index.html"))).toBe(true);
		expect(existsSync(join(output, "static/pinned/index.html"))).toBe(true);
		expect(existsSync(join(fn, "index.js"))).toBe(true);
		// without this the Node launcher reads the ESM bundle as CommonJS
		expect(JSON.parse(readFileSync(join(fn, "package.json"), "utf8"))).toEqual({
			private: true,
			type: "module",
		});
		expect(JSON.parse(readFileSync(join(fn, ".vc-config.json"), "utf8"))).toEqual({
			runtime: "nodejs20.x",
			handler: "index.js",
			launcherType: "Nodejs",
			shouldAddHelpers: false,
		});
	});

	it("caches hashed assets, serves the filesystem, then falls through to the function", () => {
		const config: VercelConfig = JSON.parse(readFileSync(join(output, "config.json"), "utf8"));
		expect(config.version).toBe(3);
		expect(config.routes[0]).toMatchObject({
			src: "^/assets/(.*)$",
			headers: { "cache-control": "public, immutable, max-age=31536000" },
			continue: true,
		});
		expect(config.routes[1]).toEqual({ handle: "filesystem" });
		expect(config.routes.at(-1)).toEqual({ src: "/.*", dest: "/fn" });
	});

	it("bundles the function, since only its own directory is uploaded", () => {
		const bundled = readFileSync(join(fn, "index.js"), "utf8");
		expect(bundled).not.toMatch(/from "@implementjs\//);
	});

	it("renders pages and serves endpoints from the function", async () => {
		const page = await fetch(`${origin}/dynamic`, { headers: { "x-user": "ada" } });
		expect(page.status).toBe(200);
		expect(page.headers.get("x-route-id")).toBe("/dynamic");
		expect(await page.text()).toContain("hello ada");

		const posted = await fetch(`${origin}/api`, {
			method: "POST",
			body: JSON.stringify({ hello: "world" }),
			headers: { "content-type": "application/json", "x-user": "ada" },
		});
		expect(await posted.json()).toEqual({ echoed: { hello: "world" }, user: "ada" });
	});

	it("takes the client address from the proxy, not the socket", async () => {
		const response = await fetch(`${origin}/api`, {
			headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
		});
		expect(response.status).toBe(200);
	});
});
