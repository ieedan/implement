[![npm version](https://img.shields.io/npm/v/@implementjs/eslint.svg)](https://www.npmjs.com/package/@implementjs/eslint) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/eslint.svg)](https://www.npmjs.com/package/@implementjs/eslint)

# @implementjs/eslint

Lint rules for the [implement](https://implementjs.dev) mistakes types cannot catch: a
subscription whose unsubscribe went missing, a misspelled aria attribute, a `Lifecycle` that
wanted to be a `Watch`.

```sh
npm install -D @implementjs/eslint
```

The same package is the plugin for both linters.

## oxlint

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
	jsPlugins: ["@implementjs/eslint"],
	rules: {
		"implementjs/no-hanging-unsubscribe": "error",
		"implementjs/no-signal-condition": "error",
		"implementjs/prefer-foreach": "error",
		"implementjs/valid-aria": "error",
	},
});
```

## ESLint

```ts
// eslint.config.ts
import implementjs from "@implementjs/eslint";

export default [implementjs.configs.recommended];
```

Full documentation: [implementjs.dev/eslint](https://implementjs.dev/eslint)
