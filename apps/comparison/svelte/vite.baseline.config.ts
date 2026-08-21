import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

/**
 * The "hello world" build: a counter and nothing else. Subtracting it from the
 * app build separates the framework's runtime floor from what the app costs.
 */
export default defineConfig({
	plugins: [svelte()],
	build: {
		target: "es2022",
		outDir: "dist-baseline",
		emptyOutDir: true,
		rollupOptions: { input: "baseline.html" },
	},
});
