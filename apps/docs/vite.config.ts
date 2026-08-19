import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { implement } from "@implementjs/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const veliteDir = resolve(import.meta.dirname, ".velite");
const lessonsDir = resolve(import.meta.dirname, "src/content/lessons");

/** Every route, straight from the Velite collections plus the static pages. */
function routes(): string[] {
	const collect = (file: string): string[] => {
		const pages: { permalink: string }[] = JSON.parse(
			readFileSync(resolve(veliteDir, file), "utf8"),
		);
		return pages.map((page) => page.permalink);
	};
	return [
		"/",
		"/packages",
		"/primitives",
		"/repl",
		...collect("pages.json"),
		...collect("primitives.json"),
		...collect("lucide.json"),
		...collect("tutorials.json"),
	];
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		implement({ stylesheets: ["/app.css"], prerender: { routes } }),
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
