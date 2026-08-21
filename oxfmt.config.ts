import { defineConfig } from "oxfmt";

export default defineConfig({
	useTabs: true,
	printWidth: 100,
	sortPackageJson: false,
	// registry.json is written by `pnpm registry`, and CI fails on any drift from what jsrepo emits
	ignorePatterns: ["pnpm-lock.yaml", "dist/**", ".velite/**", "apps/docs/registry.json"],
});
