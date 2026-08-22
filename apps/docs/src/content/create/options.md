---
title: Options
description: Every flag the CLI takes, for scripting it or skipping the prompts.
section: Reference
order: 4
---

```sh
npm create implement-app@latest [directory] -- [options]
```

`directory` is where the app goes, relative to the current directory. Leave it off and the CLI asks, defaulting to `implement-app`.

The `--` is npm's; pnpm, yarn, and bun pass flags through without it.

## Project

| Flag             | What it does                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `--name <name>`  | The name written into `package.json`. Defaults to the directory name, normalized into something npm accepts. |
| `-t, --template` | `kit` or `csr`. See [Templates](/create/templates).                                                          |
| `--tailwind`     | Set up Tailwind. `--no-tailwind` opts out.                                                                   |
| `--primitives`   | Add [`@implementjs/primitives`](/primitives). `--no-primitives` opts out.                                    |
| `--ui`           | Add [`@implementjs/ui`](/ui). Turns on `--tailwind` and `--primitives`; `--no-ui` opts out.                  |
| `--icons`        | Add [`@implementjs/lucide`](/lucide). `--no-icons` opts out.                                                 |
| `--forms`        | Add [`@implementjs/formish`](/formish) and valibot. `--no-forms` opts out.                                   |
| `--mode-watcher` | Add [`@implementjs/mode-watcher`](/mode-watcher). `--no-mode-watcher` opts out.                              |
| `--oxlint`       | Set up oxlint and oxfmt. See [Adders](/create/adders). `--no-oxlint` opts out.                               |
| `--overwrite`    | Scaffold into the directory even if it already has files in it.                                              |

Without `--overwrite`, a non-empty directory stops the run — interactively it asks first.

## After scaffolding

| Flag                | What it does                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--install`         | Install dependencies. For the kit template this also runs `sync`, so `.implement/` exists and the app typechecks immediately. With `--ui` it also runs `jsrepo add button`, the one component the starter page renders. |
| `--git`             | Run `git init` in the new directory.                                                                                                                                                                                    |
| `--package-manager` | `npm`, `pnpm`, `yarn`, `bun`, or `deno`. Detected from the environment otherwise.                                                                                                                                       |

The package manager is picked up from how you invoked the CLI, so `pnpm create implement-app` installs with pnpm without being told.

## Running unattended

| Flag            | What it does                                                              |
| --------------- | ------------------------------------------------------------------------- |
| `-y, --yes`     | Skip every prompt, using defaults for anything a flag didn't answer.      |
| `--cwd <path>`  | Resolve relative paths against this directory instead of the current one. |
| `--verbose`     | Log each step instead of collapsing it into a spinner.                    |
| `-V, --version` | Print the CLI version.                                                    |

Prompts are also skipped whenever there is no terminal attached, so agents and CI drive the CLI entirely with flags — `--yes` is only needed when a terminal _is_ attached.

The defaults a skipped prompt falls back to: the `kit` template, the Tailwind addon, and no addons or adders beyond it.

## add

`add` applies an [adder](/create/adders) to an app that already exists:

```sh
npx create-implement-app add [adders...] [options]
```

| Flag                | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `[adders...]`       | The adders to add. Leave it off to be asked which.                        |
| `--cwd <path>`      | The app to add to, instead of the current directory.                      |
| `--install`         | Install the dependencies the adder added.                                 |
| `--overwrite`       | Replace config files and scripts the app already has.                     |
| `--package-manager` | `npm`, `pnpm`, `yarn`, `bun`, or `deno`. Detected from the app otherwise. |
| `--link <path>`     | Point the implement packages the adder needs at a local clone.            |
| `--workspace`       | Depend on the implement packages with `workspace:*`.                      |
| `-y, --yes`         | Skip the prompt.                                                          |
| `--verbose`         | Log each step instead of collapsing it into a spinner.                    |
