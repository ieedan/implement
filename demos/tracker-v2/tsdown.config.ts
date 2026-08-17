import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	target: "es2022",
	// Tailwind writes dist/app.css; the default clean removes it on every JS build.
	clean: false,
	deps: {
		alwaysBundle: ["@packages/ui_v2"],
		onlyBundle: false,
	},
});
