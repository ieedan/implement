---
title: Setup
description: Wiring the rules into oxlint or ESLint, and turning one off where you meant it.
section: Start Here
order: 2
---

The same package is the plugin for both linters. Pick the one you already run.

## oxlint

Add the plugin to `jsPlugins` and turn the rules on. `jsPlugins` is where oxlint loads ESLint-format plugins from; everything else stays as it was.

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
	jsPlugins: ["@implementjs/eslint"],
	rules: {
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
});
```

> [!NOTE]
> oxlint's JS plugin support is in alpha and its docs say it is not covered by semver. Pin oxlint to an exact version if your CI depends on these rules, so a patch release cannot change the plugin API underneath you.

## ESLint

The same package is an ordinary flat-config plugin, and it ships a `recommended` config that turns on every rule at the severities above.

```ts
// eslint.config.ts
import implementjs from "@implementjs/eslint";

export default [implementjs.configs.recommended];
```

Or wire the rules up yourself, if you want different severities:

```ts
import implementjs from "@implementjs/eslint";

export default [
	{
		files: ["**/*.ts"],
		plugins: { implementjs },
		rules: { "implementjs/valid-aria": "error" },
	},
];
```

## Turning a rule off

Both linters honour a disable comment on the line above, with the same syntax:

```ts
// oxlint-disable-next-line implementjs/no-hanging-unsubscribe -- the store outlives the app on purpose
telemetry.enabled.subscribe(flush);
```

Under ESLint the prefix is `eslint-disable-next-line` instead. For a whole directory — generated files, fixtures, a module full of ARIA tables — prefer an `overrides` entry in the config over a comment in every file.
