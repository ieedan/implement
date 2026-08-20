import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/bin.ts", "src/index.ts"],
	format: ["esm"],
	alias: {
		"@/": "./src/",
	},
	minify: true,
});
