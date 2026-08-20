import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/sync.ts"],
	outDir: "dist",
	target: "es2022",
});
