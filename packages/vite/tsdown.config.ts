import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/inject.ts"],
	outDir: "dist",
	target: "es2022",
});
