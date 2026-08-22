import { rmSync } from "node:fs";
import { join } from "node:path";
import type { RenderToStringResult } from "@implementjs/core/server";
import { build, createServer, type ViteDevServer } from "vite";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Dynamic module loading and rollup output need intentional narrowing. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kit } from "../src/index.ts";

const app = join(import.meta.dirname, "fixtures/env-app");
const guardApp = join(import.meta.dirname, "fixtures/env-guard");

/** The value in the fixture's .env that must never reach a browser. */
const SECRET = "hunter2-fixture-secret";
const PUBLIC_VALUE = "https://example.test";

function devServer(root: string): Promise<ViteDevServer> {
	return createServer({
		root,
		configFile: false,
		logLevel: "error",
		server: { middlewareMode: true, watch: null },
		// the fixtures import only first-party sources, and a rejected transform leaves the dep
		// optimizer with a request that never settles — which `server.close()` then waits on
		optimizeDeps: { noDiscovery: true, include: [] },
		plugins: [kit()],
	});
}

async function transformIn(
	server: ViteDevServer,
	environment: "client" | "ssr",
	url: string,
): Promise<string> {
	const result = await server.environments[environment].transformRequest(url);
	if (result === null) throw new Error(`no transform result for ${url}`);
	return result.code;
}

describe("env files", () => {
	let server: ViteDevServer;

	beforeAll(async () => {
		server = await devServer(app);
	});

	afterAll(async () => {
		await server.close();
		rmSync(join(app, ".implement"), { recursive: true, force: true });
	});

	it("inlines the public file as literals in the server graph", async () => {
		const code = await transformIn(server, "ssr", "/src/lib/env.public.ts");
		expect(code).toContain(`"PUBLIC_SITE_URL":"${PUBLIC_VALUE}"`);
		expect(code).toContain('"PUBLIC_ANALYTICS_ID":"UA-fixture"');
		expect(code).not.toContain("zod");
		expect(code).not.toContain("defineEnv");
	});

	it("inlines the public file as literals in the client graph too", async () => {
		const code = await transformIn(server, "client", "/src/lib/env.public.ts");
		expect(code).toContain(`"PUBLIC_SITE_URL":"${PUBLIC_VALUE}"`);
		expect(code).not.toContain("zod");
	});

	it("inlines every export of the file, not just the defineEnv call", async () => {
		expect(await transformIn(server, "client", "/src/lib/env.public.ts")).toContain('"public"');
	});

	it("inlines the server file as literals in the server graph", async () => {
		const code = await transformIn(server, "ssr", "/src/lib/env.server.ts");
		expect(code).toContain(SECRET);
	});

	it("compiles the server file to a throwing body with no values in the client graph", async () => {
		const code = await transformIn(server, "client", "/src/lib/env.server.ts");
		expect(code).not.toContain(SECRET);
		expect(code).not.toContain("DATABASE_URL");
		expect(code).toContain("throw new Error(");
		expect(code).toContain("src/lib/env.server.ts is a server file");
		// the module keeps its shape, so importers link and fail at evaluation
		expect(code).toContain("as env");
	});

	it("reaches server env values from a load function", async () => {
		const { render } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: (url: string) => Promise<RenderToStringResult>;
		};
		expect((await render("/secrets")).html).toContain(`postgres://user:${SECRET}@localhost/db`);
	});

	it("reaches server env values from hooks.server.ts", async () => {
		const { render } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: (url: string) => Promise<RenderToStringResult>;
		};
		expect((await render("/from-hook")).html).toContain(SECRET);
	});

	it("renders public env values into the page", async () => {
		const { render } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: (url: string) => Promise<RenderToStringResult>;
		};
		expect((await render("/")).html).toContain(PUBLIC_VALUE);
	});
});

describe("the built client bundle", () => {
	let chunks: string;

	beforeAll(async () => {
		const result = (await build({
			root: app,
			configFile: false,
			logLevel: "error",
			plugins: [kit({ prerender: false })],
			build: { write: false },
		})) as { output: { type: string; code?: string; source?: string | Uint8Array }[] };
		chunks = result.output
			.map((entry) => entry.code ?? (typeof entry.source === "string" ? entry.source : ""))
			.join("\n");
	}, 60_000);

	afterAll(() => {
		rmSync(join(app, ".implement"), { recursive: true, force: true });
	});

	it("carries the public values", () => {
		expect(chunks).toContain(PUBLIC_VALUE);
	});

	it("does not contain the server secret anywhere — the whole point", () => {
		expect(chunks).not.toContain(SECRET);
		expect(chunks).not.toContain("DATABASE_URL");
	});

	it("does not ship the schema library", () => {
		expect(chunks).not.toContain("defineEnv");
	});
});

describe("the illegal-import guard", () => {
	let server: ViteDevServer;

	beforeAll(async () => {
		server = await devServer(guardApp);
	});

	afterAll(async () => {
		await server.close();
		rmSync(join(guardApp, ".implement"), { recursive: true, force: true });
	});

	it("rejects a client file importing a server file", async () => {
		await expect(transformIn(server, "client", "/src/routes/leaky/page.ts")).rejects.toThrow(
			/src\/lib\/secrets\.server\.ts is a server file/,
		);
	});

	it("names the client file that reached for it", async () => {
		await expect(transformIn(server, "client", "/src/routes/leaky/page.ts")).rejects.toThrow(
			/imported by src\/routes\/leaky\/page\.ts/,
		);
	});

	it("names the import that dragged a server file in, not just the file", async () => {
		// the page's own import is legal on its face, so the file name alone leaves the
		// reader bisecting `@/lib/issue-schema` for whichever binding is the culprit
		await transformIn(server, "client", "/src/routes/deep/page.ts");
		await expect(transformIn(server, "client", "/src/lib/issue-schema.ts")).rejects.toThrow(
			/routes\/deep\/page\.ts:3 imports \{ schema \}/,
		);
	});

	it("rejects a client file importing a route's server.ts", async () => {
		await expect(
			transformIn(server, "client", "/src/routes/endpoint-import/page.ts"),
		).rejects.toThrow(/routes\/api\/thing\/server\.ts is a route endpoint/);
	});

	it("names the endpoint import that did it", async () => {
		await expect(
			transformIn(server, "client", "/src/routes/endpoint-import/page.ts"),
		).rejects.toThrow(/imported by src\/routes\/endpoint-import\/page\.ts/);
	});

	it("leaves an ordinary server.ts outside the routes directory alone", async () => {
		const code = await transformIn(server, "client", "/src/routes/plain-server/page.ts");
		expect(code).toContain("lib/server");
	});

	it("stubs the client copy of an endpoint, values and all", async () => {
		const code = await transformIn(server, "client", "/src/routes/api/thing/server.ts");
		expect(code).toContain("is a route endpoint and cannot run in the browser");
		expect(code).not.toContain("guard-fixture-token");
	});

	it("lets the server graph import an endpoint", async () => {
		await expect(
			transformIn(server, "ssr", "/src/routes/endpoint-import/page.ts"),
		).resolves.toContain("api/thing/server");
	});

	it("leaves type-only imports alone", async () => {
		const code = await transformIn(server, "client", "/src/routes/type-only/page.ts");
		expect(code).not.toContain("secrets.server");
	});

	it("trips on an inline `type` specifier, the documented papercut", async () => {
		// `import { type Secret } from "./x.server"` leaves a bare import under
		// verbatimModuleSyntax; `import type { Secret }` is the form that works
		await expect(transformIn(server, "client", "/src/routes/inline-type/page.ts")).rejects.toThrow(
			/is a server file and cannot be imported by client code/,
		);
	});

	it("leaves `?raw` imports alone — that is the file's text, not its bindings", async () => {
		const code = await transformIn(server, "client", "/src/routes/raw-source/page.ts");
		expect(code).toContain("secrets.server.ts?raw");
	});

	it("serves the `?raw` module as text rather than stubbing it", async () => {
		const code = await transformIn(server, "client", "/src/lib/secrets.server.ts?raw");
		expect(code).toContain("guard-fixture-token");
		expect(code).not.toContain("throw new Error(");
	});

	it("lets a server file import another server file", async () => {
		const code = await transformIn(server, "ssr", "/src/lib/reader.server.ts");
		expect(code).toContain("/src/lib/secrets.server.ts");
	});

	it("lets the server graph import server files from anywhere", async () => {
		await expect(transformIn(server, "ssr", "/src/routes/leaky/page.ts")).resolves.toContain(
			"secrets.server",
		);
	});

	it("fails the build and reports the chain back through the router", async () => {
		let message = "";
		try {
			await build({
				root: guardApp,
				configFile: false,
				logLevel: "silent",
				plugins: [kit({ prerender: false })],
				build: { write: false },
			});
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("is a server file and cannot be imported by client code");
		expect(message).toContain("$implement/router");
	}, 60_000);
});
