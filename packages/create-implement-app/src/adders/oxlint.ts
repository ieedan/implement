import dedent from "dedent";
import type { Adder } from "@/adders/types";

/** The scripts the adder writes, so the app lints and formats the same way this repo does. */
export const OXLINT_SCRIPTS = {
	lint: "oxlint",
	"lint:fix": "oxlint --fix",
	format: "oxfmt",
	"format:check": "oxfmt --check",
} as const;

/**
 * The rules from `@implementjs/eslint`, at the severities it recommends. They are ESLint rules,
 * loaded through oxlint's ESLint-compatible plugin API — the same package either linter runs.
 *
 * @see https://implementjs.dev/eslint/setup
 */
const IMPLEMENT_RULES: Record<string, "error" | "warn"> = {
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
};

/**
 * What both configs stay out of: the build output, and the `.implement/` kit regenerates on every
 * sync. Neither is written by hand, and linting `.implement/` would report on generated code.
 */
const IGNORED = ["dist/**", ".implement/**"];

/** Linting and formatting on the [oxc](https://oxc.rs) toolchain, plus the framework's own rules. */
export const oxlint: Adder = {
	id: "oxlint",
	label: "oxlint + oxfmt",
	hint: "Lint and format with oxc, and the @implementjs/eslint rules",
	devDependencies: ["@implementjs/eslint", "oxfmt", "oxlint"],
	scripts: { ...OXLINT_SCRIPTS },
	// the templates write what reads well in the generator — a long class list on one line, a
	// `lib: []` per line — which is not always what oxfmt would write. Formatting once on the way
	// out is what makes `format:check` pass on an app nobody has touched yet.
	postInstallScript: "format",
	files: () => [
		{ path: "oxlint.config.ts", contents: oxlintConfig() },
		{ path: "oxfmt.config.ts", contents: oxfmtConfig() },
	],
};

function oxlintConfig(): string {
	return `${[
		`import { defineConfig } from "oxlint";`,
		``,
		`export default defineConfig({`,
		`\tplugins: ["eslint", "typescript", "unicorn", "oxc", "import"],`,
		`\t// The framework's own rules. They are an ESLint plugin, run here through oxlint's`,
		`\t// ESLint-compatible plugin API — see https://implementjs.dev/eslint.`,
		`\tjsPlugins: ["@implementjs/eslint"],`,
		`\tcategories: {`,
		`\t\tcorrectness: "error",`,
		`\t\tsuspicious: "warn",`,
		`\t},`,
		`\trules: {`,
		`\t\t// Signal callbacks commonly reuse the signal name for the unwrapped value.`,
		`\t\t"no-shadow": "off",`,
		`\t\t// CSS imports are side-effect-only by design in Vite apps.`,
		`\t\t"import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],`,
		...Object.entries(IMPLEMENT_RULES).map(
			([rule, severity]) => `\t\t${JSON.stringify(rule)}: ${JSON.stringify(severity)},`,
		),
		`\t},`,
		`\tignorePatterns: [${IGNORED.map((pattern) => JSON.stringify(pattern)).join(", ")}],`,
		`\toverrides: [`,
		`\t\t{`,
		`\t\t\t// \`export {}\` is what makes an ambient file a module, which is what \`declare global\``,
		`\t\t\t// needs — src/app.d.ts ends on one, and it is not an export anybody wrote by mistake.`,
		`\t\t\tfiles: ["**/*.d.ts"],`,
		`\t\t\trules: {`,
		`\t\t\t\t"unicorn/require-module-specifiers": "off",`,
		`\t\t\t},`,
		`\t\t},`,
		`\t],`,
		`});`,
	].join("\n")}\n`;
}

/**
 * oxfmt's defaults are prettier's, and everything the templates write is tabs at 100 columns — so
 * the config says that, and formatting a freshly scaffolded app changes nothing.
 */
function oxfmtConfig(): string {
	return (
		dedent`
		import { defineConfig } from "oxfmt";

		export default defineConfig({
			useTabs: true,
			printWidth: 100,
			ignorePatterns: [${IGNORED.map((pattern) => JSON.stringify(pattern)).join(", ")}],
		});
	` + "\n"
	);
}
