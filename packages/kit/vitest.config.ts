import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		// bizi and other runners set FORCE_COLOR=1; kit stamps dim timestamps on dev
		// log lines, so keep tests comparing raw logger output color-free.
		env: {
			NO_COLOR: "1",
		},
	},
});
