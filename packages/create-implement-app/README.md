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

| Addon        | Package                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `tailwind`   | `tailwindcss` through `@tailwindcss/vite`                                    |
| `primitives` | [`@implementjs/primitives`](../primitives) — headless, accessible components |
| `icons`      | [`@implementjs/lucide`](../lucide) — Lucide icons as implement components    |

Each addon changes the generated app: tailwind swaps the stylesheet and adds the Vite plugin, primitives wraps the starter page's links in a collapsible, and icons swap the counter's button labels for Lucide icons.

## Non-interactive

Every prompt has a flag, and the CLI never prompts when `--yes` is passed or when stdout isn't a TTY — so agents and CI can drive it end to end:

```sh
pnpm create implement-app my-app --template kit --tailwind --primitives --no-icons --yes
```

Anything a flag didn't answer falls back to the defaults: the `kit` template, tailwind on, primitives and icons off, and the directory `implement-app`.

| Flag                     | Default            | What it does                                                |
| ------------------------ | ------------------ | ----------------------------------------------------------- |
| `[directory]`            | `implement-app`    | Where the app is created, relative to `--cwd`               |
| `--name <name>`          | the directory name | The name written into `package.json`                        |
| `-t, --template <t>`     | `kit`              | `kit` or `csr`                                              |
| `--tailwind`             | on                 | Set up tailwindcss (`--no-tailwind` to skip)                |
| `--primitives`           | off                | Add `@implementjs/primitives` (`--no-primitives` to skip)   |
| `--icons`                | off                | Add `@implementjs/lucide` (`--no-icons` to skip)            |
| `--package-manager <pm>` | detected           | `npm`, `pnpm`, `yarn`, `bun`, or `deno`                     |
| `--install`              | off                | Install dependencies after scaffolding                      |
| `--git`                  | off                | Run `git init` in the new app                               |
| `--workspace`            | off                | Depend on the implement packages with `workspace:*`         |
| `--overwrite`            | off                | Scaffold into a directory that isn't empty                  |
| `-y, --yes`              | off                | Skip every prompt                                           |
| `--cwd <path>`           | `process.cwd()`    | The directory `[directory]` resolves against                |
| `--verbose`              | off                | Log every file as it's written instead of showing a spinner |

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

## Inside the monorepo

implement isn't published to a registry yet, so a generated `package.json` asks for `latest` and will only install once the packages land. To scaffold an app inside this repo, pass `--workspace` — the implement dependencies come out as `workspace:*` and resolve against the workspace:

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
