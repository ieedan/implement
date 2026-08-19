import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const veliteDir = resolve(import.meta.dirname, ".velite");
const lessonsDir = resolve(import.meta.dirname, "src/content/lessons");

export default defineConfig({
	plugins: [
		tailwindcss(),
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
