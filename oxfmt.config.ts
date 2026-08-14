import { defineConfig } from "oxfmt";

export default defineConfig({
	useTabs: true,
	printWidth: 100,
	sortPackageJson: false,
	ignorePatterns: ["pnpm-lock.yaml", "dist/**", "demos/todo/src/api/**"],
});
