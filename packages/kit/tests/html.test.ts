import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createServer, type ResolvedConfig, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { previewPages, resolveShell, shellOutputPlugin } from "../src/html.ts";
import { kit } from "../src/index.ts";

const SHELL = `<!doctype html>
<html lang="en">
	<head>
		<title>shell</title>
		<script type="module" src="/.implement/entry-client.ts"></script>
	</head>
	<body id="root"></body>
</html>
`;

/** Every dev test boots its own vite, and the first request pays for dep optimization. */
const TIMEOUT = 30_000;

let root: string | null = null;

/**
 * A kit app with one page, one static file, and the shell wherever the test wants it. It is built
 * under `fixtures/` rather than a temp dir so the generated entries resolve `@implementjs/core`.
 */
function makeApp(shellPath: string | null): string {
	root = mkdtempSync(join(import.meta.dirname, "fixtures/html-"));
	mkdirSync(join(root, "src/routes"), { recursive: true });
	writeFileSync(
		join(root, "src/routes/index.ts"),
		`import { H1 } from "@implementjs/core";\nexport default () => H1("home");\n`,
	);
	writeFileSync(
		join(root, "src/routes/error.ts"),
		`import { P } from "@implementjs/core";\nexport default () => P("not found");\n`,
	);
	mkdirSync(join(root, "static"), { recursive: true });
	writeFileSync(join(root, "static/hello.txt"), "static hello\n");
	if (shellPath !== null) {
		mkdirSync(join(root, shellPath, ".."), { recursive: true });
		writeFileSync(join(root, shellPath), SHELL);
	}
	return root;
}

afterEach(() => {
	if (root !== null) rmSync(root, { recursive: true, force: true });
	root = null;
});

async function withServer(
	appRoot: string,
	fn: (origin: string, server: ViteDevServer) => Promise<void>,
): Promise<void> {
	const server = await createServer({
		root: appRoot,
		configFile: false,
		logLevel: "error",
		server: { middlewareMode: true, watch: null },
		// these apps have no dependencies to prebundle, and the scanner racing with close() is what
		// makes a short-lived dev server hang on teardown
		optimizeDeps: { noDiscovery: true, include: [] },
		plugins: [kit()],
	});
	const listener: Server = createHttpServer(server.middlewares);
	await new Promise<void>((done) => listener.listen(0, done));
	try {
		const { port } = listener.address() as AddressInfo;
		await fn(`http://localhost:${port}`, server);
	} finally {
		// fetch leaves the socket keep-alive, and close() would wait it out
		listener.closeAllConnections();
		await new Promise((done) => listener.close(done));
		await server.close();
	}
}

const page = (origin: string, path: string) =>
	fetch(origin + path, { headers: { accept: "text/html" } });

describe("resolveShell", () => {
	it("prefers src/index.html", () => {
		const app = makeApp("src/index.html");
		writeFileSync(join(app, "index.html"), SHELL);
		expect(resolveShell(app)?.relative).toBe("src/index.html");
	});

	it("falls back to a root index.html", () => {
		expect(resolveShell(makeApp("index.html"))?.relative).toBe("index.html");
	});

	it("is null when the app has no shell", () => {
		expect(resolveShell(makeApp(null))).toBeNull();
	});
});

describe("the dev server with a shell under src/", () => {
	it(
		"serves it for every navigation",
		async () => {
			await withServer(makeApp("src/index.html"), async (origin) => {
				const home = await page(origin, "/");
				expect(home.status).toBe(200);
				expect(home.headers.get("content-type")).toContain("text/html");
				const html = await home.text();
				expect(html).toContain("/.implement/entry-client.ts");
				// the shell went through transformIndexHtml, so the SSR render landed in it
				expect(html).toContain("<h1>home</h1>");

				// an unmatched path renders the error route into the shell, as a 404
				const deep = await page(origin, "/nope");
				expect(deep.status).toBe(404);
				expect(await deep.text()).toContain("<p>not found</p>");
			});
		},
		TIMEOUT,
	);

	it(
		"leaves static files to vite",
		async () => {
			await withServer(makeApp("src/index.html"), async (origin) => {
				const response = await fetch(`${origin}/hello.txt`);
				expect(response.status).toBe(200);
				expect(await response.text()).toBe("static hello\n");
			});
		},
		TIMEOUT,
	);

	it(
		"still serves a root index.html the way vite always has",
		async () => {
			await withServer(makeApp("index.html"), async (origin) => {
				const response = await page(origin, "/");
				expect(response.status).toBe(200);
				expect(await response.text()).toContain("<h1>home</h1>");
			});
		},
		TIMEOUT,
	);
});

describe("previewPages", () => {
	/** A prerendered build: a page at the root, one nested, and the 404 fallback. */
	function makeDist(): string {
		root = mkdtempSync(join(import.meta.dirname, "fixtures/preview-"));
		const dist = join(root, "dist");
		mkdirSync(join(dist, "about"), { recursive: true });
		writeFileSync(join(dist, "index.html"), "<h1>home</h1>");
		writeFileSync(join(dist, "about/index.html"), "<h1>about</h1>");
		writeFileSync(join(dist, "404.html"), "<h1>not found</h1>");
		return dist;
	}

	async function withPreview(dist: string, fn: (origin: string) => Promise<void>): Promise<void> {
		const middleware = previewPages(dist);
		const listener: Server = createHttpServer((req, res) => {
			middleware(req, res, () => {
				res.statusCode = 418;
				res.end("passed through");
			});
		});
		await new Promise<void>((done) => listener.listen(0, done));
		try {
			await fn(`http://localhost:${(listener.address() as AddressInfo).port}`);
		} finally {
			listener.closeAllConnections();
			await new Promise((done) => listener.close(done));
		}
	}

	it("serves the prerendered page for a path, and 404.html for one without", async () => {
		await withPreview(makeDist(), async (origin) => {
			const home = await page(origin, "/");
			expect(home.status).toBe(200);
			expect(await home.text()).toBe("<h1>home</h1>");

			expect(await (await page(origin, "/about")).text()).toBe("<h1>about</h1>");

			const missing = await page(origin, "/nope");
			expect(missing.status).toBe(404);
			expect(await missing.text()).toBe("<h1>not found</h1>");
		});
	});

	it("leaves assets and non-page requests to vite's own static serving", async () => {
		await withPreview(makeDist(), async (origin) => {
			const asset = await fetch(`${origin}/assets/app.js`);
			expect(asset.status).toBe(418);
			const posted = await fetch(`${origin}/`, {
				method: "POST",
				headers: { accept: "text/html" },
			});
			expect(posted.status).toBe(418);
		});
	});

	it("does not serve pages from outside the output directory", async () => {
		await withPreview(makeDist(), async (origin) => {
			const escaped = await fetch(`${origin}/..%2f..%2fetc`, { headers: { accept: "text/html" } });
			expect(escaped.status).toBe(404);
		});
	});
});

describe("shellOutputPlugin", () => {
	const emit = (appRoot: string, fileName: string): Record<string, { fileName: string }> => {
		const plugin = shellOutputPlugin();
		const configResolved = plugin.configResolved as (config: ResolvedConfig) => void;
		const generateBundle = plugin.generateBundle as (
			options: unknown,
			bundle: Record<string, { fileName: string }>,
		) => void;
		configResolved({ root: appRoot } as ResolvedConfig);
		const bundle = { [fileName]: { fileName } };
		generateBundle({}, bundle);
		return bundle;
	};

	it("moves a src/index.html output back to the root of dist", () => {
		const bundle = emit(makeApp("src/index.html"), "src/index.html");
		expect(Object.keys(bundle)).toEqual(["index.html"]);
		expect(bundle["index.html"]?.fileName).toBe("index.html");
	});

	it("leaves a root index.html output alone", () => {
		expect(Object.keys(emit(makeApp("index.html"), "index.html"))).toEqual(["index.html"]);
	});
});
