---
"create-implement-app": patch
---

Add oxlint and oxfmt as an adder, and an `add` command that applies adders to an app that already exists.

`--oxlint` sets up linting and formatting while scaffolding — an `oxlint.config.ts` running the `@implementjs/eslint` rules through oxlint's plugin API, an `oxfmt.config.ts` matching what the templates write, and `lint`, `lint:fix`, `format`, and `format:check` scripts. With `--install` the run formats the app on the way out, so `format:check` passes before anything has been edited.

The same setup is one command away later:

```sh
npx create-implement-app add oxlint
```

`add` writes only what the app doesn't already have — a config file edited since, a script under a name it wanted, a dependency it already depends on are each kept and reported, and `--overwrite` replaces them instead.
