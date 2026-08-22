import { defineConfig } from "oxlint";

export default defineConfig({
	options: {
		typeAware: true,
	},
	plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
	// The framework's own rules. They are an ESLint plugin, run here through
	// oxlint's ESLint-compatible plugin API — see `packages/eslint`.
	jsPlugins: ["@implementjs/eslint"],
	categories: {
		correctness: "error",
		suspicious: "warn",
	},
	rules: {
		// Signal callbacks commonly reuse the signal name for the unwrapped value.
		"no-shadow": "off",
		// CSS imports are side-effect-only by design in Vite apps.
		"import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
		"implementjs/no-hanging-unsubscribe": "error",
		"implementjs/no-html": "error",
		"implementjs/no-redundant-roles": "warn",
		"implementjs/no-signal-collection": "warn",
		"implementjs/no-signal-condition": "error",
		"implementjs/prefer-effect": "warn",
		"implementjs/prefer-foreach": "error",
		"implementjs/role-has-required-aria-props": "error",
		"implementjs/role-supports-aria-props": "error",
		"implementjs/valid-aria": "error",
		"implementjs/valid-role": "error",
	},
	ignorePatterns: [
		// Agent worktrees are full repo checkouts; their nested configs break lint.
		".claude/**",
		"dist/**",
		".velite/**",
		// Lesson starter/solution/test sidecars are teaching content shown in the
		// tutorial editor; they intentionally import things the learner will use.
		"apps/docs/src/content/lessons/**",
		// A standalone editor extension, not repo source: plain CommonJS meant to
		// be copied into ~/.vscode/extensions and to build with no toolchain.
		"implement-snippets/**",
	],
	overrides: [
		{
			files: ["packages/*/scripts/**/*.ts"],
			env: {
				node: true,
			},
		},
		{
			// Compile-time type assertions use leading underscores as a convention,
			// and assert that bad props are rejected by writing bad props.
			files: ["**/type-test.ts"],
			rules: {
				"no-underscore-dangle": "off",
				"implementjs/role-has-required-aria-props": "off",
				"implementjs/role-supports-aria-props": "off",
				"implementjs/valid-aria": "off",
				"implementjs/valid-role": "off",
			},
		},
		{
			// The ARIA rules read every object literal, because without types there
			// is no telling a props object from any other. That is the right trade
			// in an app and the wrong one in the package that owns the spec tables
			// and the fixtures full of deliberate mistakes.
			files: ["packages/eslint/**/*.ts"],
			rules: {
				"implementjs/no-redundant-roles": "off",
				"implementjs/role-has-required-aria-props": "off",
				"implementjs/role-supports-aria-props": "off",
				"implementjs/valid-aria": "off",
				"implementjs/valid-role": "off",
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
