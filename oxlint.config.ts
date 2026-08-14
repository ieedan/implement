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
	ignorePatterns: ["dist/**", "demos/todo/src/api/**"],
	overrides: [
		{
			files: ["packages/ui/scripts/**/*.ts", "demos/todo/server/**/*.ts"],
			env: {
				node: true,
			},
		},
	],
});
