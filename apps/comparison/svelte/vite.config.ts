import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [svelte()],
	build: { target: "es2022" },
	server: { port: 3012, strictPort: true },
	preview: { port: 4012, strictPort: true },
});
