import { describe, expect, it } from "vitest";
import { injectSsr } from "../src/inject.ts";
import { crawlRoutes, normalizeRoute } from "../src/prerender.ts";

const shell = `<html>\n\t<head>\n\t\t<title>shell</title>\n\t</head>\n\t<body id="root"></body>\n</html>`;

describe("injectSsr", () => {
	it("wraps the markup in a layout-neutral [data-ssr] element", () => {
		const page = injectSsr(shell, { html: "<h1>Hi</h1>", head: "" });
		expect(page).toContain(
			'<body id="root"><div data-ssr style="display: contents"><h1>Hi</h1></div>',
		);
	});

	it("replaces the shell title with the SSR title", () => {
		const page = injectSsr(shell, { html: "", head: "<title>Page ~ site</title>" });
		expect(page).toContain("<title>Page ~ site</title>");
		expect(page).not.toContain("<title>shell</title>");
	});

	it("keeps the shell title when the render sets none", () => {
		const page = injectSsr(shell, { html: "", head: '<meta name="description" content="d" />' });
		expect(page).toContain("<title>shell</title>");
		expect(page).toContain('<meta name="description" content="d" />');
	});

	it("inlines dev styles into the head, tagged for Vite's client to adopt", () => {
		const page = injectSsr(shell, { html: "", head: "" }, [
			{ id: "/src/app.css", content: "body { color: red }" },
		]);
		expect(page).toContain(
			'<style type="text/css" data-vite-dev-id="/src/app.css">body { color: red }</style>',
		);
	});

	it("embeds route data as an escaped JSON script tag", () => {
		const page = injectSsr(shell, { html: "<p>x</p>", head: "", data: { note: "</script>" } });
		expect(page).toContain(
			'</div><script type="application/json" data-implement-data>{"note":"\\u003c/script>"}</script>',
		);
	});

	it("embeds no data script when the render has no data", () => {
		const page = injectSsr(shell, { html: "", head: "" });
		expect(page).not.toContain("data-implement-data");
	});

	it("escapes style content that would close the tag early", () => {
		const page = injectSsr(shell, { html: "", head: "" }, [
			{ id: "/a.css", content: 'q::before { content: "</style>" }' },
		]);
		expect(page).toContain('content: "<\\/style>"');
	});
});

describe("crawlRoutes", () => {
	it("follows internal links transitively and skips assets, anchors, and cycles", async () => {
		const pages: Record<string, string> = {
			"/": '<a href="/docs">d</a> <a href="/logo.svg">asset</a> <a href="#top">anchor</a>',
			"/docs": '<a href="/docs/deep/">trailing</a> <a href="/">back</a>',
			"/docs/deep": '<a href="/docs">up</a>',
		};
		const render = (url: string) => ({ html: pages[url] ?? "", head: "" });
		expect((await crawlRoutes(render)).toSorted()).toEqual(["/", "/docs", "/docs/deep"]);
	});
});

describe("normalizeRoute", () => {
	it("drops trailing slashes but keeps the root", () => {
		expect(normalizeRoute("/docs/")).toBe("/docs");
		expect(normalizeRoute("/")).toBe("/");
	});
});
