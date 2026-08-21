import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/adapter.ts",
		"src/handler.ts",
		"src/node.ts",
		"src/runtime.ts",
		"src/server.ts",
		"src/sync.ts",
		"src/cli.ts",
	],
	outDir: "dist",
	target: "es2022",
});
