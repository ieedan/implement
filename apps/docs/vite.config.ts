import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { injectSsr } from "./scripts/inject";

const veliteDir = resolve(import.meta.dirname, ".velite");
const lessonsDir = resolve(import.meta.dirname, "src/content/lessons");

/** Serves every dev page server-rendered, so a refresh paints before any JS loads. */
function ssrHtml(): Plugin {
	let server: ViteDevServer | undefined;
	return {
		name: "ssr-html",
		apply: "serve",
		configureServer(s) {
			server = s;
		},
		transformIndexHtml: {
			order: "post",
			async handler(html, ctx) {
				if (!server) return html;
				try {
					const { render } = (await server.ssrLoadModule("/src/entry-server.ts")) as {
						render: (url: string) => { html: string; head: string };
					};
					const page = injectSsr(html, render(ctx.originalUrl ?? "/"));
					// dev loads CSS through JS modules, which would paint the SSR
					// markup unstyled; a stylesheet link blocks first paint instead
					return page.replace("</head>", `<link rel="stylesheet" href="/app.css" />\n\t</head>`);
				} catch (error) {
					server.config.logger.error(
						`ssr render failed for ${ctx.originalUrl}: ${error instanceof Error ? error.message : error}`,
					);
					return html;
				}
			},
		},
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		ssrHtml(),
		{
			name: "reload-velite",
			configureServer(server) {
				server.watcher.add([veliteDir, lessonsDir]);
				let reload: ReturnType<typeof setTimeout> | undefined;
				server.watcher.on("change", (file) => {
					const lessonTs =
						file.startsWith(lessonsDir) &&
						(file.endsWith("/code.ts") || file.endsWith("/solution.ts"));
					if (!lessonTs && !file.startsWith(veliteDir)) return;
					clearTimeout(reload);
					reload = setTimeout(() => {
						server.ws.send({ type: "full-reload" });
					}, 50);
				});
			},
		},
	],
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	server: { port: 3004, strictPort: true },
});
