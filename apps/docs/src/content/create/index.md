---
title: Introduction
description: Scaffold a new implement app from the command line.
section: Start Here
order: 1
---

`create-implement-app` scaffolds a working implement app in one command. It writes the project files, wires up the addons you picked, and can install dependencies and initialize a git repository for you.

```sh
npm create implement-app@latest
```

The other package managers spell it much the same way:

```sh
pnpm create implement-app
yarn create implement-app
bun create implement-app
```

Answer three questions — where the app goes, which template to start from, and what else to set up — and you have an app you can `dev` immediately.

## Skip the questions

Every prompt has a matching flag, so the same command runs unattended in CI or under an agent:

```sh
npm create implement-app@latest my-app -- --template kit --tailwind --yes
```

npm needs the `--` before the flags; the other package managers pass them straight through. [Options](/create/options) has the full list.

## What you get

Two starting points, covered in [Templates](/create/templates):

- **implement-kit** — file-based routing, server rendering in dev, a prerendered static site on build.
- **CSR with vite** — a client-rendered single page app on plain Vite.

Both open on the same counter page behind the same two-link nav, so the difference you see is the project shape, not the demo. On top of either you can layer [Tailwind](https://tailwindcss.com), [`@implementjs/primitives`](/primitives), [`@implementjs/ui`](/ui), [`@implementjs/lucide`](/lucide), [`@implementjs/formish`](/formish), and [`@implementjs/mode-watcher`](/mode-watcher).

Linting and formatting come as an [adder](/create/adders), which is the same setup written whether you ask for it while scaffolding or long after:

```sh
npx create-implement-app add oxlint
```

Everything the CLI generates is TypeScript, and nothing it writes is hidden behind a runtime — the generated app is yours to edit from the first commit.

## Where to next

- [Templates](/create/templates) — what each template writes, and what the addons add.
- [Adders](/create/adders) — oxlint and oxfmt, and the `add` command that applies them later.
- [Options](/create/options) — every flag, for scripting the CLI or skipping the prompts.

<!-- w1 -->

<!-- w2 -->

<!-- w3 -->

<!-- w4 -->

<!-- w5 -->

<!-- w6 -->

<!-- w7 -->

<!-- w8 -->

<!-- w9 -->

<!-- w10 -->
