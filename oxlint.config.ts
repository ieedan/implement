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
	ignorePatterns: ["dist/**", "demos/*/src/api/**"],
	overrides: [
		{
			files: [
				"packages/ui/scripts/**/*.ts",
				"packages/ui_v2/scripts/**/*.ts",
				"demos/*/server/**/*.ts",
			],
			env: {
				node: true,
			},
		},
	],
});
