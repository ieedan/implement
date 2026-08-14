import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	target: "es2022",
	deps: {
		alwaysBundle: ["@packages/ui"],
		onlyBundle: false,
	},
});
