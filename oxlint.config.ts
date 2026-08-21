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
		// CSS imports are side-effect-only by design in Vite apps.
		"import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
	},
	ignorePatterns: [
		// Agent worktrees are full repo checkouts; their nested configs break lint.
		".claude/**",
		"dist/**",
		".velite/**",
		// Lesson starter/solution/test sidecars are teaching content shown in the
		// tutorial editor; they intentionally import things the learner will use.
		"apps/docs/src/content/lessons/**",
	],
	overrides: [
		{
			files: ["packages/*/scripts/**/*.ts"],
			env: {
				node: true,
			},
		},
		{
			// The benchmark driver and the three comparison apps talk to each other
			// through globals a page harness conventionally underscores.
			files: ["apps/comparison/**/*.ts"],
			rules: {
				"no-underscore-dangle": ["warn", { allow: ["__bench", "__domCounts", "__resetDomCounts"] }],
			},
		},
		{
			// Compile-time type assertions use leading underscores as a convention.
			files: ["**/type-test.ts"],
			rules: {
				"no-underscore-dangle": "off",
			},
		},
		{
			files: ["**/lesson-test.ts", "**/tutorial-test.ts"],
			rules: {
				"no-underscore-dangle": ["warn", { allow: ["__setActiveLesson"] }],
			},
		},
		{
			// @implementjs/formish landed on main with generic inference sites still
			// awaiting line-level ignores — keep CI green until those are added.
			files: ["packages/formish/**/*.ts"],
			rules: {
				"typescript/no-unsafe-type-assertion": "off",
				"typescript/no-unnecessary-type-parameters": "off",
			},
		},
	],
});
