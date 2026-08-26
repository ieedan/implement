import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { RenderToStringResult } from "@implementjs/core/server";
import { build, createServer, type ViteDevServer } from "vite";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Dynamic module loading and rollup output need intentional narrowing. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Adapter } from "../src/adapter.ts";
import { kit } from "../src/index.ts";

const app = join(import.meta.dirname, "fixtures/env-app");
const guardApp = join(import.meta.dirname, "fixtures/env-guard");

/** The value in the fixture's .env that must never reach a browser. */
const SECRET = "hunter2-fixture-secret";
const PUBLIC_VALUE = "https://example.test";
/** The value in the fixture's .env that is read by the running server, not baked in. */
const ROTATING = "rotating-fixture-token";
/** The public value in the fixture's .env that the page carries rather than the bundle. */
const RUNTIME_API = "https://runtime.example.test";

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
		expect(code).not.toContain("valibot");
		expect(code).not.toContain("defineEnv");
	});

	it("inlines the public file as literals in the client graph too", async () => {
		const code = await transformIn(server, "client", "/src/lib/env.public.ts");
		expect(code).toContain(`"PUBLIC_SITE_URL":"${PUBLIC_VALUE}"`);
		expect(code).not.toContain("valibot");
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

	it("leaves the dynamic file alone in the server graph — values, schemas and all", async () => {
		const code = await transformIn(server, "ssr", "/src/lib/env.dynamic.server.ts");
		// not inlined: no value is known yet, so the call and its schemas survive
		expect(code).toContain("defineDynamicEnv");
		expect(code).not.toContain(ROTATING);
	});

	it("compiles the dynamic file to a throwing body in the client graph", async () => {
		const code = await transformIn(server, "client", "/src/lib/env.dynamic.server.ts");
		expect(code).not.toContain(ROTATING);
		expect(code).not.toContain("ROTATING_TOKEN");
		expect(code).toContain("throw new Error(");
		expect(code).toContain("src/lib/env.dynamic.server.ts is a server file");
		expect(code).toContain("as env");
	});

	it("leaves the public dynamic file alone in the server graph", async () => {
		const code = await transformIn(server, "ssr", "/src/lib/env.dynamic.public.ts");
		expect(code).toContain("defineDynamicPublicEnv");
		expect(code).not.toContain(RUNTIME_API);
	});

	it("replaces the public dynamic file in the client graph with a reader, not schemas", async () => {
		const code = await transformIn(server, "client", "/src/lib/env.dynamic.public.ts");
		expect(code).toContain("data-implement-env");
		expect(code).toContain("as env");
		// the server validated and coerced already, so none of this has to ship
		expect(code).not.toContain("defineDynamicPublicEnv");
		expect(code).not.toContain("valibot");
		// nor are the values baked in — they belong to the request, not the build
		expect(code).not.toContain(RUNTIME_API);
	});

	it("carries the public dynamic values in the page it renders", async () => {
		const { render } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: (url: string) => Promise<RenderToStringResult & { env?: Record<string, unknown> }>;
		};
		const result = await render("/runtime");
		expect(result.html).toContain(`${RUNTIME_API} limit 25`);
		// coerced by the schema before it is embedded, so the client gets a number
		expect(result.env).toEqual({
			env: { PUBLIC_RUNTIME_API: RUNTIME_API, PUBLIC_RUNTIME_LIMIT: 25 },
		});
	});

	it("generates a server entry that imports the file, since this app has one", () => {
		const entry = readFileSync(join(app, ".implement/entry-server.ts"), "utf8");
		expect(entry).toContain("env.dynamic.public");
		expect(entry).toContain("publicEnv");
	});

	it("serves the current values at /_implement/env.js for pages that carry none", async () => {
		const { respond } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			respond: (request: Request) => Promise<Response>;
		};
		const response = await respond(new Request("http://localhost/_implement/env.js"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("javascript");
		expect(await response.text()).toContain(RUNTIME_API);
	});

	it("reads dynamic env values from a load function, sourced from .env", async () => {
		const { render } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			render: (url: string) => Promise<RenderToStringResult>;
		};
		// `loadEnv` never populates `process.env`, so this only renders if the plugin
		// pointed the dynamic file at the values it resolved
		expect((await render("/rotating")).html).toContain(`${ROTATING} for 3600s`);
	});
});

describe("the dynamic env file's name", () => {
	it("must be a server file, because kit does not replace its body", async () => {
		await expect(
			createServer({
				root: app,
				configFile: false,
				logLevel: "silent",
				server: { middlewareMode: true, watch: null },
				optimizeDeps: { noDiscovery: true, include: [] },
				plugins: [kit({ env: { dynamic: "src/lib/env.dynamic.ts" } })],
			}),
		).rejects.toThrow(/must be named `\*\.server\.ts`/);
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

	it("does not contain the dynamic file's values or its keys either", () => {
		expect(chunks).not.toContain(ROTATING);
		expect(chunks).not.toContain("ROTATING_TOKEN");
	});

	it("does not ship the schema library", () => {
		expect(chunks).not.toContain("defineEnv");
		expect(chunks).not.toContain("defineDynamicPublicEnv");
	});

	it("reads the public dynamic values from the page rather than carrying them", () => {
		expect(chunks).toContain("data-implement-env");
		expect(chunks).not.toContain(RUNTIME_API);
	});
});

describe("the built server bundle", () => {
	let code = "";

	beforeAll(async () => {
		let entry: string | null = null;
		const adapter: Adapter = {
			name: "test-adapter",
			adapt(builder) {
				entry = join(builder.serverDir!, builder.serverEntry);
			},
		};
		await build({
			root: app,
			configFile: false,
			logLevel: "silent",
			// the prerender renders through a throwaway dev server built from this
			// same inline config, and a fixture that imports only first-party
			// sources has nothing for the dep optimizer to usefully prebundle.
			// Its own cache dir too: the fixture has no package.json, so vite would
			// otherwise put one under `packages/kit` and race the other suites for it
			optimizeDeps: { noDiscovery: true, include: [] },
			cacheDir: join(app, ".vite-cache"),
			plugins: [kit({ adapter, prerender: false })],
		});
		if (entry === null) throw new Error("the adapter never ran");
		code = readFileSync(entry, "utf8");
	}, 120_000);

	afterAll(() => {
		rmSync(join(app, ".implement"), { recursive: true, force: true });
	});

	it("bakes the static server value in, as it always has", () => {
		expect(code).toContain(SECRET);
	});

	it("carries the dynamic file's schemas rather than its values", () => {
		// the key is declared in the bundle because the schemas run there; the value
		// is not, because the environment it comes from does not exist yet
		expect(code).toContain("ROTATING_TOKEN");
		expect(code).not.toContain(ROTATING);
	});

	it("resolves the runtime entry the dynamic file imports", () => {
		expect(code).toContain("defineDynamicEnv");
	});
});

describe("a prerendered page and its public dynamic env", () => {
	/** Builds the fixture with prerendering on and returns the prerendered landing page. */
	async function prerenderedIndex(adapter?: Adapter): Promise<string> {
		let clientDir = join(app, "dist");
		await build({
			root: app,
			configFile: false,
			logLevel: "silent",
			plugins: [
				kit(
					adapter === undefined
						? {}
						: {
								adapter: {
									...adapter,
									adapt(builder) {
										clientDir = builder.clientDir;
									},
								},
							},
				),
			],
		});
		return readFileSync(join(clientDir, "index.html"), "utf8");
	}

	afterAll(() => {
		rmSync(join(app, ".implement"), { recursive: true, force: true });
		rmSync(join(app, "dist"), { recursive: true, force: true });
		rmSync(join(app, ".vite-cache"), { recursive: true, force: true });
	});

	it("boots from the server's values when the app ships a server", async () => {
		const html = await prerenderedIndex({ name: "test-adapter", adapt() {} });
		// first in head: module scripts run in document order, so the values are
		// assigned before the app's entry — and anything it imports — evaluates
		expect(html).toMatch(/<head[^>]*><script type="module" src="\/_implement\/env\.js">/);
	}, 120_000);

	it("keeps the build's values when there is no server to ask", async () => {
		const html = await prerenderedIndex();
		expect(html).not.toContain("_implement/env.js");
		// still carried, so the page works — it is just as baked-in as env.public.ts
		expect(html).toContain("data-implement-env");
		expect(html).toContain(RUNTIME_API);
	}, 120_000);
});

describe("an app with no public dynamic env file", () => {
	let server: ViteDevServer;

	beforeAll(async () => {
		server = await devServer(guardApp);
	});

	afterAll(async () => {
		await server.close();
		rmSync(join(guardApp, ".implement"), { recursive: true, force: true });
	});

	it("generates a server entry that does not import or serve one", () => {
		const entry = readFileSync(join(guardApp, ".implement/entry-server.ts"), "utf8");
		expect(entry).not.toContain("publicEnv");
		expect(entry).not.toContain("env.dynamic.public");
	});

	it("has no /_implement/env.js route at all", async () => {
		const { respond } = (await server.ssrLoadModule("/.implement/entry-server.ts")) as {
			respond: (request: Request) => Promise<Response>;
		};
		const response = await respond(new Request("http://localhost/_implement/env.js"));
		expect(response.status).toBe(404);
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
		// The fixture has three illegal client imports — `leaky` and `inline-type`
		// reach a `*.server.ts`, `endpoint-import` reaches a route `server.ts` —
		// and the build fails on whichever Rollup resolves first, so the kind in
		// the message is a race. Which kind it is has its own cases above; what
		// this one is for is that the guard fails the build at all and traces the
		// chain back through the router.
		expect(message).toMatch(
			/is (a server file|a route endpoint) and cannot be imported by client code/,
		);
		expect(message).toContain("$implement/router");
	}, 60_000);
});
