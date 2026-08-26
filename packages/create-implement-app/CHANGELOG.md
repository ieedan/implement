# create-implement-app

## 0.0.8

### Patch Changes

- [#75](https://github.com/ieedan/implement/pull/75) [`992e998`](https://github.com/ieedan/implement/commit/992e9986c0e35ef8064943f2a6404271b68d514a) Thanks [@ieedan](https://github.com/ieedan)! - Scaffold an app the bundled formatter leaves alone. Running the template's own `pnpm format` in a new project rewrote files the developer never opened — `.vscode/extensions.json` and `.vscode/settings.json` collapsing their arrays, and, less visibly, the `tsconfig.json`, the `package.json`, the README's script table and every component holding a Tailwind class list long enough to wrap. The generator wrote what read well in the generator; oxfmt writes what prettier's rules say, and the two disagreed. Both templates now emit what the `oxfmt.config.ts` next to them would have written: arrays collapsed where they fit inside 100 columns, a value dropped below its key only where the formatter would drop it, and `package.json` in the key order oxfmt puts a manifest in. A test materialises both templates against every combination of addons and holds `oxfmt --check` clean over all of them.

  Target ES2023 in the emitted `tsconfig.json`, both `target` and `lib`. The bundled `oxlint.config.ts` turns on the `unicorn` rules, and two of them fix to an ES2023 array method — `no-array-sort` to `Array#toSorted()` and `no-array-reverse` to `Array#toReversed()` — so on ES2022 `pnpm lint` asked for a method `pnpm check` said did not exist, over something as ordinary as sorting a list. The version the rules need is now a constant next to them, and a test holds the templates' target at or above it.

## 0.0.7

### Patch Changes

- [#70](https://github.com/ieedan/implement/pull/70) [`899a612`](https://github.com/ieedan/implement/commit/899a6129b6ed6dd001b7bec9445a1bc2f3d843ae) Thanks [@ieedan](https://github.com/ieedan)! - Route the csr template with `@implementjs/router`: `src/router.ts` holds the table, `src/layout.ts` the nav both routes render inside, and `src/not-found.ts` the fallback. Views that read `router` annotate their return type, since inferring it would mean inferring `router` from the table that renders them.

- [#70](https://github.com/ieedan/implement/pull/70) [`dc8afec`](https://github.com/ieedan/implement/commit/dc8afec501579ce02c509d21252a94da9935211d) Thanks [@ieedan](https://github.com/ieedan)! - Drop `@implementjs/router` from the kit template's dependencies. Nothing a kit app writes imports it, and kit now resolves it itself — so the app no longer carries a version of a package it never names.

## 0.0.6

### Patch Changes

- [#68](https://github.com/ieedan/implement/pull/68) [`679c8f6`](https://github.com/ieedan/implement/commit/679c8f6808b1d6bdb7f0e9f88565d944ebd6023c) Thanks [@ieedan](https://github.com/ieedan)! - Write `.vscode/settings.json` for a tailwind app, so the recommended tailwind extension finds the classes an implement component actually holds — `class:` object properties, the `styles = { ... }` object the generated components keep their classes in, and `cn()`/`tv()` with the `ui` addon.

## 0.0.5

### Patch Changes

- [#57](https://github.com/ieedan/implement/pull/57) [`b51e829`](https://github.com/ieedan/implement/commit/b51e8295af17c8d72287b71e6e312c50bcc12c4f) Thanks [@ieedan](https://github.com/ieedan)! - Use valibot as the schema library everywhere the docs and templates need one

  Kit still takes any [Standard Schema](https://standardschema.dev) — arktype and zod included,
  each still converted to JSON Schema through its own package — but every example, doc and
  scaffolded file is now written in valibot, which is what `@implementjs/formish` already
  required. A scaffolded kit app ships `valibot` as a devDependency in place of `zod`.

  Kit's valibot-to-JSON-Schema conversion now runs with `errorMode: "ignore"`, so a schema
  carrying a transform is documented as unconstrained instead of dropping the route's
  parameters and warning. That matches what the zod converter already did with
  `unrepresentable: "any"`.

## 0.0.4

### Patch Changes

- [#36](https://github.com/ieedan/implement/pull/36) [`e883ade`](https://github.com/ieedan/implement/commit/e883ade584f4c33e8ef25acde7c80e5be106e7bb) Thanks [@ieedan](https://github.com/ieedan)! - `--link` skips private packages in the linked clone. A `link:` specifier naming one would resolve only for as long as the clone stayed where it is, and npm has nothing to fall back to — `@implementjs/ui`, whose package in the workspace carries the registry's version and no code, is the one this exists for.

## 0.0.3

### Patch Changes

- [#43](https://github.com/ieedan/implement/pull/43) [`58f51a7`](https://github.com/ieedan/implement/commit/58f51a762b2bd883689325554dd865e4cf3e1646) Thanks [@ieedan](https://github.com/ieedan)! - Scaffold apps with a version range on each implement package instead of `latest`. `latest` resolves at install time, so two runs of the same CLI produced apps built against different releases. The range is a tilde — a floor later patches clear on their own — so a new app still starts on the current release without the CLI having to be told about it.

## 0.0.2

### Patch Changes

- [#37](https://github.com/ieedan/implement/pull/37) [`b2dcb33`](https://github.com/ieedan/implement/commit/b2dcb33e00fd8e148c5c607e0fc0819ea3eb0419) Thanks [@ieedan](https://github.com/ieedan)! - Add oxlint and oxfmt as an adder, and an `add` command that applies adders to an app that already exists.

  `--oxlint` sets up linting and formatting while scaffolding — an `oxlint.config.ts` running the `@implementjs/eslint` rules through oxlint's plugin API, an `oxfmt.config.ts` matching what the templates write, and `lint`, `lint:fix`, `format`, and `format:check` scripts. With `--install` the run formats the app on the way out, so `format:check` passes before anything has been edited.

  The same setup is one command away later:

  ```sh
  npx create-implement-app add oxlint
  ```

  `add` writes only what the app doesn't already have — a config file edited since, a script under a name it wanted, a dependency it already depends on are each kept and reported, and `--overwrite` replaces them instead.

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

- [#32](https://github.com/ieedan/implement/pull/32) [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66) Thanks [@ieedan](https://github.com/ieedan)! - Publish the node-authoring API and extract the router.

  `@implementjs/core` gains `Outlet`, a swappable mount region whose children are mounted
  through core — so context lookups, error boundaries, hydration and server rendering all
  work inside one — and `location`, the current `RouterLocation` as a `Readable`. Core also
  restores the scroll position of the entry a reload landed on off the first location
  subscription, so a hand-written router gets that for free.

  `Router` moves to the new `@implementjs/router`, written against that public API and
  nothing else. `@implementjs/core/router` is gone; navigation stays in core (`location`,
  `navigateTo`, `searchParam`, the navigation guards and the resolver).

  kit generates `import { Router } from "@implementjs/router"` and takes it as a dependency,
  and scaffolded kit apps list it too — generated code resolves from the app, not from kit.

- [`32df6ae`](https://github.com/ieedan/implement/commit/32df6ae7557c0745a54cae6e3ba4367a5da1f1d5) Thanks [@ieedan](https://github.com/ieedan)! - Scaffold a `.vscode/extensions.json` recommending `implementjs.implement-vscode`,
  so a new app prompts to install the editor extension on first open. Apps created
  with the tailwind addon also get `bradlc.vscode-tailwindcss`.

  Recommendations only — nothing installs itself, and an editor that does not read
  the file ignores it.
