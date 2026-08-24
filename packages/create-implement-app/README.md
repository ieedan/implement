[![npm version](https://img.shields.io/npm/v/create-implement-app.svg)](https://www.npmjs.com/package/create-implement-app) [![npm downloads](https://img.shields.io/npm/dm/create-implement-app.svg)](https://www.npmjs.com/package/create-implement-app)

# create-implement-app

Scaffold a new [implement](https://github.com/ieedan/implement) app.

```sh
pnpm create implement-app
```

Answer three questions — where the app goes, which template to start from, and what else to set up — and the CLI writes a working app you can `dev` immediately.

## Templates

| Template | What you get                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------- |
| `kit`    | [`@implementjs/kit`](../kit): file based routing, server rendering in dev, a prerendered build |
| `csr`    | A client rendered app on plain [Vite](https://vite.dev)                                        |

Both templates are TypeScript.

## Addons

| Addon         | Package                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `tailwind`    | `tailwindcss` through `@tailwindcss/vite`                                          |
| `primitives`  | [`@implementjs/primitives`](../primitives) — headless, accessible components       |
| `ui`          | `@implementjs/ui` — styled components, copied in with [jsrepo](https://jsrepo.dev) |
| `icons`       | [`@implementjs/lucide`](../lucide) — Lucide icons as implement components          |
| `forms`       | [`@implementjs/formish`](../formish) — schema-first forms, with valibot            |
| `modeWatcher` | [`@implementjs/mode-watcher`](../mode-watcher) — dark mode, before the first paint |

Each addon changes the generated app: tailwind swaps the stylesheet and adds the Vite plugin, primitives wraps the starter page's links in a collapsible, ui swaps the stylesheet again for the design tokens the styled components read and puts a `Button` in the counter, icons swap the counter's button labels for Lucide icons, forms adds a validated sign up form under the counter, and mode-watcher gives the app a light and a dark palette with a toggle that switches between them.

A tailwind app also gets a `.vscode/settings.json`, because the extension `.vscode/extensions.json` recommends does nothing in an implement component on its own: there is no JSX, so a class is an object property in a call (`Div({ class: "flex gap-2" }, ...)`) rather than an attribute the extension knows how to find. The settings name that shape, the `styles = { ... }` object the generated components keep their classes in, and — with the `ui` addon — the `cn()` and `tv()` those components pass classes through.

`ui` turns on `tailwind` and `primitives` whatever the flags said — the styled components are Tailwind classes over the primitives, so an app without them would scaffold with a first component that doesn't render.

## Adders

| Adder    | What it adds                                                                               |
| -------- | ------------------------------------------------------------------------------------------ |
| `oxlint` | [oxlint](https://oxc.rs) and [oxfmt](https://oxc.rs), with the `@implementjs/eslint` rules |

An addon changes the app the templates write — tailwind swaps the stylesheet, icons change what the counter renders — so it only means something while the app is being created. An adder is self contained: config files of its own, dependencies, and scripts. That is what lets it be added later, to an app that already exists:

```sh
pnpm create implement-app my-app --oxlint   # while scaffolding
pnpm dlx create-implement-app add oxlint    # any time after
```

Both write the same thing. `add` runs in the current directory unless `--cwd` points somewhere else, asks which adders to apply when none are named, and leaves alone anything the app already has — a config file that has been edited since, a script under a name it wanted, a dependency it already depends on. Each of those is reported, and `--overwrite` replaces them instead. Running it twice changes nothing the second time.

| Flag                     | Default         | What it does                                                |
| ------------------------ | --------------- | ----------------------------------------------------------- |
| `[adders...]`            | prompted        | The adders to add                                           |
| `--install`              | off             | Install dependencies after adding                           |
| `--overwrite`            | off             | Replace config files and scripts the app already has        |
| `--package-manager <pm>` | detected        | `npm`, `pnpm`, `yarn`, `bun`, or `deno`                     |
| `--link <path>`          | off             | Link the implement packages to a local clone                |
| `--workspace`            | off             | Depend on the implement packages with `workspace:*`         |
| `-y, --yes`              | off             | Skip every prompt                                           |
| `--cwd <path>`           | `process.cwd()` | The app to add to                                           |
| `--verbose`              | off             | Log every file as it's written instead of showing a spinner |

### oxlint

The adder writes an `oxlint.config.ts` and an `oxfmt.config.ts`, adds `oxlint`, `oxfmt`, and [`@implementjs/eslint`](../eslint) as dev dependencies, and gives the app four scripts:

```jsonc
// my-app/package.json
{
	"scripts": {
		"lint": "oxlint",
		"lint:fix": "oxlint --fix",
		"format": "oxfmt",
		"format:check": "oxfmt --check",
	},
}
```

The lint config runs the framework's own rules — the ones that catch a dropped unsubscribe, a signal tested for truth, or a `.get().map()` that renders a list once and never again — through oxlint's ESLint-compatible plugin API. `oxfmt` is set to tabs at 100 columns, which is what the templates write; `create --oxlint --install` runs `format` once on the way out, so a freshly scaffolded app passes `format:check` before anything has been edited.

## Styled components

The `ui` addon sets the app up as a consumer of the `@implementjs/ui` [jsrepo](https://jsrepo.dev) registry rather than adding a dependency: a `jsrepo.config.ts` naming the registry and where its items land, `jsrepo` and `tailwind-variants` in `package.json`, a `ui` script, and an `app.css` carrying the tokens every component reads.

```jsonc
// my-app/package.json
{
	"scripts": {
		"ui": "jsrepo add",
	},
}
```

```sh
pnpm run ui dialog select    # npm run ui -- dialog select
```

`--install` also runs `jsrepo add button`, so the counter's buttons — which the starter page renders through the styled `Button` — are on disk before the first `dev`. Without it the components are one command away, and the next steps printed at the end of the run name it.

## Installing with pnpm

A pnpm app also gets a `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

pnpm doesn't run a dependency's install scripts until the project names it, and since pnpm 11 an unnamed one fails the install with `ERR_PNPM_IGNORED_BUILDS` rather than warning. `esbuild` — vite's transformer — downloads its platform binary in a `postinstall`, so without that file the first `pnpm install` stops. Nothing else in a generated app has a build script. The file is skipped for the other package managers, and for `--workspace`, where a nested workspace root would be wrong and the monorepo's own file already covers it.

## Non-interactive

Every prompt has a flag, and the CLI never prompts when `--yes` is passed or when stdout isn't a TTY — so agents and CI can drive it end to end:

```sh
pnpm create implement-app my-app --template kit --tailwind --primitives --no-icons --yes
```

Anything a flag didn't answer falls back to the defaults: the `kit` template, tailwind on, the other addons off, and the directory `implement-app`.

| Flag                     | Default            | What it does                                                  |
| ------------------------ | ------------------ | ------------------------------------------------------------- |
| `[directory]`            | `implement-app`    | Where the app is created, relative to `--cwd`                 |
| `--name <name>`          | the directory name | The name written into `package.json`                          |
| `-t, --template <t>`     | `kit`              | `kit` or `csr`                                                |
| `--tailwind`             | on                 | Set up tailwindcss (`--no-tailwind` to skip)                  |
| `--primitives`           | off                | Add `@implementjs/primitives` (`--no-primitives` to skip)     |
| `--ui`                   | off                | Add `@implementjs/ui` (`--no-ui` to skip)                     |
| `--icons`                | off                | Add `@implementjs/lucide` (`--no-icons` to skip)              |
| `--forms`                | off                | Add `@implementjs/formish` (`--no-forms` to skip)             |
| `--mode-watcher`         | off                | Add `@implementjs/mode-watcher` (`--no-mode-watcher` to skip) |
| `--oxlint`               | off                | Set up oxlint and oxfmt (`--no-oxlint` to skip)               |
| `--package-manager <pm>` | detected           | `npm`, `pnpm`, `yarn`, `bun`, or `deno`                       |
| `--install`              | off                | Install dependencies after scaffolding                        |
| `--git`                  | off                | Run `git init` in the new app                                 |
| `--workspace`            | off                | Depend on the implement packages with `workspace:*`           |
| `--overwrite`            | off                | Scaffold into a directory that isn't empty                    |
| `-y, --yes`              | off                | Skip every prompt                                             |
| `--cwd <path>`           | `process.cwd()`    | The directory `[directory]` resolves against                  |
| `--verbose`              | off                | Log every file as it's written instead of showing a spinner   |

Errors exit non-zero with a message on stderr. Set `CREATE_IMPLEMENT_APP_TRACE=1` for a stack trace.

## Linking a local implement repo

Working on the framework itself? `--link` points every implement package the app needs at a local clone, so edits to `packages/core` show up in the app without a publish or a copy:

```sh
pnpm create implement-app my-app --link ../implement --yes
```

```jsonc
// my-app/package.json
{
	"dependencies": {
		"@implementjs/core": "link:../implement/packages/core",
	},
	"devDependencies": {
		"@implementjs/kit": "link:../implement/packages/kit",
	},
}
```

It scans `packages/*` in the clone (and the path itself, so pointing straight at one package works too) and links only what the chosen template and addons actually depend on — everything else stays on a pinned version. npm and bun get `file:` instead of `link:`, since that's the spelling they symlink for. The path is written relative to the app when that reads better than the absolute one, so a repo sitting next to the app survives the pair being moved together.

The clone needs its own dependencies installed — the linked packages resolve theirs through it. Pointing at a clone that doesn't have a package the app needs (`--primitives` against a clone without `packages/primitives`) is an error, not a silent fallback to the registry. `--link` and `--workspace` both decide how the implement packages resolve, so pass one or the other.

### The ui registry, off disk

`@implementjs/ui` is not a package, so linking it is a different mechanism: with `--ui` the generated `jsrepo.config.ts` adds jsrepo's [`fs` provider](https://jsrepo.dev/docs/providers/fs) and points `registries` at the clone, so components are read from the checkout instead of fetched.

```ts
// my-app/jsrepo.config.ts
import { DEFAULT_PROVIDERS, defineConfig } from "jsrepo";
import { fs } from "jsrepo/providers";

export default defineConfig({
	registries: ["fs://../implement/apps/docs"],
	providers: [...DEFAULT_PROVIDERS, fs()],
	paths: {
		ui: "src/lib/components/ui",
		lib: "src/lib",
	},
});
```

`DEFAULT_PROVIDERS` is spread back in so the built-in providers still work alongside it. The path points at `apps/docs` rather than the clone's root because that is where the registry is configured from — it resolves against the project its component files live in. The fs provider reads the built manifest, so the clone needs a `registry.json` — `pnpm registry` writes it. A clone without one is an error up front, rather than a run that fails after everything else has succeeded. Edit a component in the clone, run `pnpm registry` there, and `jsrepo update` in the app picks the change up.

## Inside the monorepo

A generated `package.json` asks for the `latest` tag of each implement package. To scaffold an app inside this repo, pass `--workspace` — the implement dependencies come out as `workspace:*` and resolve against the workspace:

```sh
pnpm create implement-app demos/my-demo --workspace --yes
```

## API

The scaffolder is also importable, for tests and for tools that want the file list without touching the disk:

```ts
import { getTemplate, runCreate } from "create-implement-app";

// the files a template would write, as { path, contents }
getTemplate("kit").files({ name: "my-app", addons: ["tailwind"], workspace: false });

// or scaffold, the same way the CLI does
await runCreate("my-app", {
	cwd: process.cwd() as never,
	template: "csr",
	install: false,
	git: false,
	workspace: false,
	overwrite: false,
	yes: true,
	verbose: false,
});
```

The adders are importable too — `applyAdders` is what both commands run, and it takes a `package.json` and hands back the one the adder needs, along with the files it writes:

```ts
import { applyAdders, runAdd } from "create-implement-app";

const changes = applyAdders(["oxlint"], { workspace: false, packageManager: "pnpm" }, contents);

// or apply them to an app on disk, the same way the CLI does
await runAdd(["oxlint"], {
	cwd: process.cwd() as never,
	install: false,
	workspace: false,
	overwrite: false,
	yes: true,
	verbose: false,
});
```
