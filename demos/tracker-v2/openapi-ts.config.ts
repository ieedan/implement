import { defineConfig } from "@hey-api/openapi-ts";
import { app, openapiConfig } from "./server/app";

export default defineConfig({
	// OpenAPIHono's document type is not a plain JSON object.
	input: JSON.parse(JSON.stringify(app.getOpenAPI31Document(openapiConfig))),
	output: "src/api",
	plugins: [
		"@hey-api/typescript",
		{
			name: "@hey-api/sdk",
			paramsStructure: "flat",
			operations: {
				containerName: "Api",
				strategy: "single",
			},
		},
		{
			name: "@hey-api/client-fetch",
			runtimeConfigPath: "./src/hey-api.ts",
		},
	],
});
