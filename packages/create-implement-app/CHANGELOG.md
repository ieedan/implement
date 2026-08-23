# create-implement-app

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
