import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/lib/index.ts", "src/index.ts"],
	outDir: "dist",
	target: "es2022",
});
