import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderDocument, type SsrResult } from "./inject.ts";

/** May be async — a render that resolves route data first returns a promise. */
export type RenderFn = (url: string) => SsrResult | Promise<SsrResult>;

/**
 * A pass over a prerendered page, after the render is injected and before the
 * app's own `transformPageChunk` sees it. Unlike `transformIndexHtml`, this
 * runs per route and after the client build, so it can reach for things only
 * the finished build knows — which is what kit's per-route preload hints need.
 */
export type TransformHtml = (route: string, html: string) => string;

const INTERNAL_HREF = /href="(\/[^"#?]*)"/g;

/** Trailing slashes dropped so crawled hrefs and configured routes compare equal. */
export function normalizeRoute(href: string): string {
	let route = href;
	while (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
	return route;
}

/**
 * Discovers routes by following internal links from `/` through server
 * renders — every page a reader can reach through the app's own links gets
 * prerendered. Paths with a dot are skipped as assets.
 */
export async function crawlRoutes(render: RenderFn): Promise<string[]> {
	const seen = new Set<string>(["/"]);
	const queue = ["/"];
	while (queue.length > 0) {
		const route = queue.shift()!;
		const { html } = await render(route);
		for (const match of html.matchAll(INTERNAL_HREF)) {
			const href = normalizeRoute(match[1]!);
			if (href.includes(".") || seen.has(href)) continue;
			seen.add(href);
			queue.push(href);
		}
	}
	return [...seen];
}

export async function prerenderRoutes(options: {
	render: RenderFn;
	routes: string[];
	template: string;
	outDir: string;
	transformHtml?: TransformHtml;
}): Promise<{ written: number; failed: string[] }> {
	const { render, routes, template, outDir, transformHtml } = options;
	const failed: string[] = [];
	for (const route of routes) {
		try {
			const page = await renderDocument(
				template,
				await render(route),
				[],
				transformHtml === undefined ? undefined : (html) => transformHtml(route, html),
			);
			const out =
				route === "/" ? join(outDir, "index.html") : join(outDir, route.slice(1), "index.html");
			mkdirSync(dirname(out), { recursive: true });
			writeFileSync(out, page);
		} catch (error) {
			failed.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return { written: routes.length - failed.length, failed };
}
