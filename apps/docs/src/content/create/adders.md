---
title: Adders
description: Config you can add while scaffolding, or any time after, with the add command.
section: Start Here
order: 3
---

An [addon](/create/templates#addons) changes the app the templates write — Tailwind swaps the stylesheet, icons change what the counter renders — so it only means something while the app is being created. An adder is self contained: config files of its own, dependencies, and scripts. Nothing about it depends on being there from the start, which is what lets it be added to an app that already exists.

```sh
npm create implement-app@latest my-app -- --oxlint   # while scaffolding
npx create-implement-app add oxlint                  # any time after
```

Both write the same thing.

| Adder    | What it adds                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `oxlint` | [oxlint](https://oxc.rs) and [oxfmt](https://oxc.rs), with the [`@implementjs/eslint`](/eslint) rules |

## oxlint

The adder writes an `oxlint.config.ts` and an `oxfmt.config.ts`, adds `oxlint`, `oxfmt`, and `@implementjs/eslint` as dev dependencies, and gives the app four scripts:

| Script         | What it does                      |
| -------------- | --------------------------------- |
| `lint`         | Lint the app                      |
| `lint:fix`     | Lint it, fixing what can be fixed |
| `format`       | Format every file                 |
| `format:check` | Check the formatting, for CI      |

The lint config turns on oxlint's own correctness rules and runs the framework's rules alongside them, through [oxlint's ESLint-compatible plugin API](/eslint/setup) — a dropped unsubscribe, a signal tested for truth, a `.get().map()` that renders a list once and never again:

```ts
// my-app/oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
	plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
	jsPlugins: ["@implementjs/eslint"],
	categories: {
		correctness: "error",
		suspicious: "warn",
	},
	rules: {
		"implementjs/no-hanging-unsubscribe": "error",
		// …
	},
});
```

`oxfmt` is set to tabs at 100 columns, which is what the templates write. Scaffolding with `--oxlint --install` runs `format` once on the way out — the generated files are written by a generator, not a formatter, so this is what makes `format:check` pass on an app nobody has edited yet.

Both configs stay out of `dist/` and, for the kit template, out of the generated `.implement/`.

## Adding one later

`add` applies an adder to the app in the current directory. Name the adders to apply, or leave them off and it asks:

```sh
npx create-implement-app add oxlint
npx create-implement-app add oxlint --cwd ./my-app --install
```

It leaves alone anything the app already has — a config file that has been edited since, a script under a name the adder wanted, a dependency the app already depends on. Each of those is reported at the end, and `--overwrite` replaces them instead of keeping them. Running the same adder twice changes nothing the second time.

| Flag                | What it does                                                                          |
| ------------------- | ------------------------------------------------------------------------------------- |
| `[adders...]`       | The adders to add. Leave it off to be asked.                                          |
| `--cwd <path>`      | The app to add to, instead of the current directory.                                  |
| `--install`         | Install the dependencies the adder added.                                             |
| `--overwrite`       | Replace config files and scripts the app already has.                                 |
| `--package-manager` | `npm`, `pnpm`, `yarn`, `bun`, or `deno`. Detected from the app otherwise.             |
| `--link <path>`     | Point the implement packages the adder needs at a local clone of the implement repo.  |
| `--workspace`       | Depend on the implement packages with `workspace:*`, for an app inside this monorepo. |
| `-y, --yes`         | Skip the prompt — with nothing named, that's an error rather than a guess.            |

The `package.json` is rewritten in place, keeping its own indentation and everything the adder had no opinion about.
