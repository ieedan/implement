import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createServer } from "vite";
import { injectSsr } from "./inject.ts";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");

const collect = (file: string): string[] => {
	const pages: { permalink: string }[] = JSON.parse(
		readFileSync(join(root, ".velite", file), "utf8"),
	);
	return pages.map((page) => page.permalink);
};

const routes = [
	"/",
	"/packages",
	"/primitives",
	"/repl",
	...collect("pages.json"),
	...collect("primitives.json"),
	...collect("lucide.json"),
	...collect("tutorials.json"),
];

const template = readFileSync(join(dist, "index.html"), "utf8");

const vite = await createServer({
	root,
	server: { middlewareMode: true },
	appType: "custom",
	logLevel: "error",
	ssr: { noExternal: ["@implementjs/core"] },
});

try {
	const { render } = (await vite.ssrLoadModule("/src/entry-server.ts")) as {
		render: (url: string) => { html: string; head: string };
	};

	const failed: string[] = [];
	for (const route of routes) {
		try {
			const page = injectSsr(template, render(route));
			const out = route === "/" ? join(dist, "index.html") : join(dist, route.slice(1), "index.html");
			mkdirSync(dirname(out), { recursive: true });
			writeFileSync(out, page);
		} catch (error) {
			failed.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	console.log(`prerendered ${routes.length - failed.length}/${routes.length} routes`);
	if (failed.length > 0) {
		console.error(`failed:\n  ${failed.join("\n  ")}`);
		process.exitCode = 1;
	}
} finally {
	await vite.close();
}
