import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// picocolors follows CI=true and bolds fragments inside CLI error messages; strip
		// color for the whole run so toContain checks on error.toString() stay stable.
		env: {
			NO_COLOR: "1",
		},
	},
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
		},
	},
});
