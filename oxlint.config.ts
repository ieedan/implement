import { defineConfig } from "oxlint";

export default defineConfig({
	options: {
		typeAware: true,
	},
	plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
	categories: {
		correctness: "error",
		suspicious: "warn",
	},
	rules: {
		// Signal callbacks commonly reuse the signal name for the unwrapped value.
		"no-shadow": "off",
	},
	ignorePatterns: [
		// Agent worktrees are full repo checkouts; their nested configs break lint.
		".claude/**",
		"dist/**",
		"demos/*/src/api/**",
		".velite/**",
		// Lesson starter/solution/test sidecars are teaching content shown in the
		// tutorial editor; they intentionally import things the learner will use.
		"apps/docs/src/content/lessons/**",
	],
	overrides: [
		{
			files: ["packages/core/scripts/**/*.ts", "demos/*/server/**/*.ts"],
			env: {
				node: true,
			},
		},
	],
});
