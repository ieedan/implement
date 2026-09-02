import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { type Server, request } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

/** Waits for a server to be listening, whatever it ended up listening on. */
function listening(server: Server): Promise<Server> {
	return new Promise((ready) => {
		server.once("listening", () => {
			ready(server);
		});
	});
}

describe("@implementjs/adapter-iis", () => {
	let built: BuiltServer;
	let server: Server;
	let origin: string;

	beforeAll(async () => {
		await build({
			root: fixture,
			configFile: false,
			logLevel: "silent",
			plugins: [
				kit({
					adapter: adapter({
						origin: "https://intranet.example.com",
						externalRoutes: ["reports"],
						env: { FEATURE_FLAGS: "a&b" },
					}),
				}),
			],
		});
		// the built server is what IIS starts: plain ESM, imported from disk
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The adapter's output exports the server it just built.
		built = (await import(pathToFileURL(join(out, "handler.js")).href)) as BuiltServer;
		server = await listening(built.start({ port: 0, host: "127.0.0.1" }));
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A listening TCP server always reports an AddressInfo.
		origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}, 180_000);

	afterAll(async () => {
		await new Promise((closed) => server.close(closed));
		rmSync(out, { recursive: true, force: true });
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("writes a directory an IIS site can be pointed at", () => {
		expect(existsSync(join(out, "index.js"))).toBe(true);
		expect(existsSync(join(out, "handler.js"))).toBe(true);
		expect(existsSync(join(out, "web.config"))).toBe(true);
		expect(existsSync(join(out, "server/index.js"))).toBe(true);
		expect(existsSync(join(out, "client/index.html"))).toBe(true);
		// the output is ESM whatever the app's own package.json says, and this
		// file is what node.exe reads when IIS starts it in this directory
		expect(JSON.parse(readFileSync(join(out, "package.json"), "utf8"))).toMatchObject({
			type: "module",
		});
		// HttpPlatformHandler runs the ESM entry as a process, so there is nothing
		// for the CommonJS shim iisnode needs to do here
		expect(existsSync(join(out, "index.cjs"))).toBe(false);
	});

	it("writes a web.config carrying the adapter's options to IIS", () => {
		const xml = readFileSync(join(out, "web.config"), "utf8");
		expect(xml).toContain('modules="httpPlatformHandler"');
		expect(xml).toContain('arguments=".\\index.js"');
		expect(xml).toContain(
			'<environmentVariable name="ORIGIN" value="https://intranet.example.com" />',
		);
		expect(xml).toContain('<environmentVariable name="NODE_ENV" value="production" />');
		expect(xml).toContain('<match url="^(reports)(/.*)?$" />');
		// an unescaped & here is a 500.19 before a single request is served
		expect(xml).toContain('<environmentVariable name="FEATURE_FLAGS" value="a&amp;b" />');
	});

	it("bundles the server's dependencies, so the folder is the whole deployment", () => {
		// nothing is left for a node_modules that will not be copied to the server.
		// Specifiers rather than the bare name: a bundled module may still *say*
		// the package — kit keys its runtime symbols by it — and a name in a
		// string is not something node has to resolve
		const source = readFileSync(join(out, "server/index.js"), "utf8");
		expect(source).not.toMatch(/\bfrom\s*["']@implementjs\/kit/);
		expect(source).not.toMatch(/\b(?:import|require)\s*\(\s*["']@implementjs\/kit/);
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

	it("answers the health check without the app running at all", async () => {
		const response = await fetch(`${origin}/healthcheck`);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
		// straight off the front of the chain: the app's hooks never saw it
		expect(response.headers.get("x-route-id")).toBeNull();
		expect(response.headers.get("cache-control")).toBe("no-store");

		// a query string is not part of the path IIS pings
		expect((await fetch(`${origin}/healthcheck?from=iis`)).status).toBe(200);
		// and only IIS's own method reaches it
		expect((await fetch(`${origin}/healthcheck`, { method: "POST" })).status).toBe(404);
	});

	it("listens on the port HttpPlatformHandler picked for it", async () => {
		process.env.HTTP_PLATFORM_PORT = "0";
		const platform = await listening(built.start());
		try {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A listening TCP server always reports an AddressInfo.
			const address = platform.address() as AddressInfo;
			expect(address.address).toBe("127.0.0.1");
			const response = await fetch(`http://127.0.0.1:${address.port}/healthcheck`);
			expect(await response.text()).toBe("ok");
		} finally {
			delete process.env.HTTP_PLATFORM_PORT;
			await new Promise((closed) => platform.close(closed));
		}
	});

	it("listens on the named pipe iisnode passes in PORT, rather than making it a NaN", async () => {
		// the pipe is a Windows path; a unix socket is the same branch, and is
		// what this machine can actually bind
		const socket = join(tmpdir(), `implement-iis-${process.pid}.sock`);
		rmSync(socket, { force: true });
		process.env.PORT = socket;
		const piped = await listening(built.start());
		try {
			expect(piped.address()).toBe(socket);
		} finally {
			delete process.env.PORT;
			await new Promise((closed) => piped.close(closed));
			rmSync(socket, { force: true });
		}
	});
});

/** A GET over a pipe, which is the only way to reach a server listening on one. */
function overSocket(socketPath: string, path: string): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		const req = request({ socketPath, path, method: "GET" }, (res) => {
			let body = "";
			res.setEncoding("utf8");
			res.on("data", (chunk: string) => (body += chunk));
			res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
		});
		req.on("error", reject);
		req.end();
	});
}

describe("@implementjs/adapter-iis, hosted by iisnode", () => {
	const iisOut = join(fixture, "dist-iisnode");

	beforeAll(async () => {
		await build({
			root: fixture,
			configFile: false,
			logLevel: "silent",
			plugins: [
				kit({
					adapter: adapter({
						hosting: "iisnode",
						out: "dist-iisnode",
						origin: "https://intranet.example.com",
					}),
				}),
			],
		});
	}, 180_000);

	afterAll(() => {
		rmSync(iisOut, { recursive: true, force: true });
		rmSync(join(fixture, ".implement"), { recursive: true, force: true });
	});

	it("points iisnode at a CommonJS entry, which is the only kind it can require", () => {
		const xml = readFileSync(join(iisOut, "web.config"), "utf8");
		expect(xml).toContain('<add name="iisnode" path="index.cjs" verb="*" modules="iisnode" />');
		// every path is rewritten onto the file iisnode is mapped to, so the
		// rewrite has to name the same one
		expect(xml).toContain('<action type="Rewrite" url="index.cjs" />');
		expect(xml).toContain('<add key="ORIGIN" value="https://intranet.example.com" />');
		expect(xml).toContain('<add key="ADDRESS_HEADER" value="x-forwarded-for" />');

		// the shim reaches the ESM entry the way CommonJS is allowed to
		const shim = readFileSync(join(iisOut, "index.cjs"), "utf8");
		expect(shim).toContain('import("./index.js")');
		expect(shim).not.toMatch(/^\s*import\s+[^(]/m);
	});

	it("serves on the named pipe once loaded as CommonJS, which is how iisnode loads it", async () => {
		// node loads a .cjs as CommonJS whatever package.json says — so this
		// runs the entry the way iisnode's interceptor does, on every Node
		// version. (Whether `require()` of the ESM entry beside it works at all
		// depends on the Node the server has: it is ERR_REQUIRE_ESM before 22,
		// and ERR_REQUIRE_ASYNC_MODULE after it for a graph with a top-level
		// await. The shim is what makes the answer not depend on that.)
		const socket = join(tmpdir(), `implement-iisnode-${process.pid}.sock`);
		rmSync(socket, { force: true });
		const child = spawn(process.execPath, [join(iisOut, "index.cjs")], {
			// what iisnode copies out of the web.config appSettings above
			env: {
				...process.env,
				PORT: socket,
				NODE_ENV: "production",
				ORIGIN: "https://intranet.example.com",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let output = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => (output += chunk));
		child.stderr.on("data", (chunk: string) => (output += chunk));

		try {
			await new Promise<void>((ready, failed) => {
				child.stdout.on("data", () => {
					if (output.includes("listening on")) ready();
				});
				child.on("exit", (code) => {
					failed(new Error(`the entry exited with ${code}:\n${output}`));
				});
			});

			expect(output).not.toContain("ERR_REQUIRE_ESM");
			expect(await overSocket(socket, "/healthcheck")).toEqual({ status: 200, body: "ok" });
		} finally {
			child.kill("SIGKILL");
			rmSync(socket, { force: true });
		}
	}, 30_000);
});
