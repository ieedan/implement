import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/adapter.ts",
		"src/client.ts",
		"src/client-neverthrow.ts",
		"src/endpoint.ts",
		"src/env-runtime.ts",
		"src/handler.ts",
		"src/mcp.ts",
		"src/navigation.ts",
		"src/node.ts",
		"src/openapi.ts",
		"src/params.ts",
		"src/runtime.ts",
		"src/server.ts",
		"src/sync.ts",
		"src/cli.ts",
	],
	outDir: "dist",
	target: "es2022",
});
