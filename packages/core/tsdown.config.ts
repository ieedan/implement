import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/server/index.ts"],
	outDir: "dist",
	target: "es2022",
});
