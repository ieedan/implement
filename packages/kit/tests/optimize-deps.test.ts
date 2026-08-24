import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kit } from "../src/index.ts";

/** Booting vite and pre-bundling for real is the only way to see what the scan found. */
const TIMEOUT = 30_000;

const SHELL = `<!doctype html>
<html lang="en">
	<head>
		<title>shell</title>
		<script type="module" src="/.implement/entry-client.ts"></script>
	</head>
	<body id="root"></body>
</html>
`;

let root: string | null = null;

/**
 * An app that names each dep exactly once, in a file the dep scanner only
 * reaches through a virtual module: a matcher, a page, and — the one that must
 * stay out of the browser's pre-bundle — a `page.server.ts`. Built under
 * `fixtures/` rather than a temp dir so the bare imports resolve.
 */
function makeApp(): string {
	const dir = mkdtempSync(join(import.meta.dirname, "fixtures/optimize-"));
	mkdirSync(join(dir, "src/routes"), { recursive: true });
	mkdirSync(join(dir, "src/params"), { recursive: true });
	writeFileSync(join(dir, "src/index.html"), SHELL);
	writeFileSync(
		join(dir, "src/params/slug.ts"),
		[
			'import * as v from "valibot";',
			'import { matcher } from "@implementjs/kit/params";',
			"",
			"export default matcher(v.pipe(v.string(), v.regex(/^[a-z]+$/)));",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(dir, "src/routes/page.ts"),
		[
			'import { z } from "zod";',
			'import { H1 } from "@implementjs/core";',
			"",
			'export default () => H1(z.string().parse("home"));',
			"",
		].join("\n"),
	);
	writeFileSync(
		join(dir, "src/routes/page.server.ts"),
		[
			'import { ok } from "neverthrow";',
			"",
			"export const load = () => ({ ok: ok(1).isOk() });",
			"",
		].join("\n"),
	);
	return dir;
}

describe("dep pre-bundling", () => {
	let server: ViteDevServer;
	/** Everything the optimizer knew about before a single request was served. */
	let prebundled: string[] = [];

	beforeAll(async () => {
		root = makeApp();
		server = await createServer({
			root,
			configFile: false,
			logLevel: "error",
			// inside the app, so a rerun never reads the last run's scan back
			cacheDir: join(root, ".vite"),
			server: { middlewareMode: true, watch: null },
			plugins: [kit()],
		});
		const optimizer = server.environments.client.depsOptimizer;
		await optimizer?.init();
		await optimizer?.scanProcessing;
		prebundled = Object.keys({
			...optimizer?.metadata.optimized,
			...optimizer?.metadata.discovered,
		});
	}, TIMEOUT);

	afterAll(async () => {
		await server.close();
		if (root !== null) rmSync(root, { recursive: true, force: true });
		root = null;
	});

	it("finds a param matcher's deps, which only `$implement/params` imports", () => {
		expect(prebundled).toContain("valibot");
	});

	it("finds a page's deps, which only `$implement/router` imports", () => {
		expect(prebundled).toContain("zod");
	});

	it("finds what the generated modules import that no file in the app does", () => {
		expect(prebundled).toContain("@implementjs/router");
		expect(prebundled).toContain("@implementjs/kit/runtime");
		expect(prebundled).toContain("@implementjs/kit/params");
	});

	it("leaves a server file's deps out of the browser's pre-bundle", () => {
		expect(prebundled).not.toContain("neverthrow");
	});
});
