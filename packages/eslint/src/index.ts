import type { ESLint, Linter, Rule } from "eslint";
import noHangingUnsubscribe from "./rules/no-hanging-unsubscribe.ts";
import noHtml from "./rules/no-html.ts";
import noSignalCollection from "./rules/no-signal-collection.ts";
import noRedundantRoles from "./rules/no-redundant-roles.ts";
import noSignalCondition from "./rules/no-signal-condition.ts";
import preferEffect from "./rules/prefer-effect.ts";
import preferForEach from "./rules/prefer-foreach.ts";
import roleHasRequiredAriaProps from "./rules/role-has-required-aria-props.ts";
import roleSupportsAriaProps from "./rules/role-supports-aria-props.ts";
import validAria from "./rules/valid-aria.ts";
import validRole from "./rules/valid-role.ts";

/**
 * Lint rules for implement apps, written against ESLint's plugin API and run
 * by either linter — see the `Linting` page in the docs for the setup on each
 * side. Nothing in here reads type information, which is what lets the same
 * rules run under oxlint, where custom rules do not get a type checker.
 */
export const rules: Record<string, Rule.RuleModule> = {
	"no-hanging-unsubscribe": noHangingUnsubscribe,
	"no-html": noHtml,
	"no-redundant-roles": noRedundantRoles,
	"no-signal-collection": noSignalCollection,
	"no-signal-condition": noSignalCondition,
	"prefer-effect": preferEffect,
	"prefer-foreach": preferForEach,
	"role-has-required-aria-props": roleHasRequiredAriaProps,
	"role-supports-aria-props": roleSupportsAriaProps,
	"valid-aria": validAria,
	"valid-role": validRole,
};

const meta = { name: "implementjs", version: "0.0.0" };

/** The severity every rule carries in the `recommended` config. */
const recommendedRules: Linter.RulesRecord = {
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

const plugin = {
	meta,
	rules,
	configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin;

// The recommended config points back at the plugin it belongs to, so it has to
// be attached after the object exists.
plugin.configs.recommended = {
	name: "implementjs/recommended",
	plugins: { implementjs: plugin },
	rules: recommendedRules,
};

export default plugin;
