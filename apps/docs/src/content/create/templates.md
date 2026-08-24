---
title: Templates
description: The two starting points, and the addons you can layer on either one.
section: Start Here
order: 2
---

Pick a template with `--template` (`-t`), or let the CLI prompt you. Both templates open on the same counter page behind the same two-link nav, so what differs is the shape of the project, not the demo — [kit](/kit) routes from the files under `src/routes`, the CSR app from a table you can read in one screen.

## implement-kit

`--template kit` — the default. A full-stack app on [`@implementjs/kit`](/kit): file-based routing, server rendering in dev, and a prerendered static site on build.

```
my-app/
├ src/
│  ├ lib/
│  │  └ counter.ts   @/lib — components, helpers, state
│  ├ routes/
│  │  ├ about/
│  │  │  └ page.ts   → /about
│  │  ├ error.ts     the 404 / render error page
│  │  ├ layout.ts    wraps every page
│  │  └ page.ts      → /
│  ├ app.css         global styles, imported from the root layout
│  ├ app.d.ts        App.Locals — what src/hooks.server.ts hands your routes
│  └ index.html      the shell, pointed at the generated client entry
├ static/            served from the site root
├ tsconfig.json
└ vite.config.ts
```

| Script    | What it does                                  |
| --------- | --------------------------------------------- |
| `dev`     | Start the dev server (server rendered, HMR)   |
| `build`   | Prerender the site into `dist/`               |
| `preview` | Serve the build locally                       |
| `sync`    | Regenerate `.implement/` without running vite |
| `prepare` | The same sync, run for you on install         |
| `check`   | Sync, then typecheck the app                  |

Kit generates `.implement/` — the client and server entries, the tsconfig the app extends, and a `./$types` for every route. It's gitignored and regenerates itself, so nothing in there needs editing. Because a fresh clone has never run Vite, [`implement-kit sync`](/kit#the-implement-directory) writes them instead: the app's `prepare` script runs it on every install, and `check` runs it again before `tsc`.

## CSR with vite

`--template csr` — a client-rendered single page app on plain Vite, with no framework plugin at all.

```
my-app/
├ src/             the vite root
│  ├ about.ts      → /about
│  ├ app.css       global styles
│  ├ counter.ts    the component / renders
│  ├ index.html    the page vite serves
│  ├ index.ts      mounts the router into #root
│  ├ layout.ts     the nav every route renders inside
│  ├ not-found.ts  the router's fallback
│  └ router.ts     the route table
├ tsconfig.json
└ vite.config.ts
```

| Script    | What it does                       |
| --------- | ---------------------------------- |
| `dev`     | Start the dev server with HMR      |
| `build`   | Build the static site into `dist/` |
| `preview` | Serve the build locally            |
| `check`   | Typecheck the app                  |

The whole app lives under `src/`, including `index.html`, so the generated Vite config sets `root: "src"` and points the build back at `dist/`. `src/index.ts` creates the app, mounts the router, and carries the [four-line HMR block](/docs/vite).

Routing is [`@implementjs/router`](/docs/router), written out rather than generated: `src/router.ts` is the whole table, and a route is a key in it. Two things about it are worth knowing before you add the third route. `src/layout.ts` imports `router` from the module that imports it back, and it works only because `router` is read inside the function body — a top-level `router.href(...)` in a view would crash at load. For the same circle, a view that reads `router` writes its return type out; inferring it would mean inferring `router` from the table that renders the view, and TypeScript stops with `TS7022`.

The router uses history-mode URLs. `dev` and `preview` serve them, and a static host needs a rewrite from unknown paths to `index.html` or a reload on `/about` is a 404.

### A note on pnpm

Installing with pnpm also gets a `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

pnpm won't run a dependency's install scripts until the project names it, and since pnpm 11 an unnamed one fails the install with `ERR_PNPM_IGNORED_BUILDS` instead of warning. Vite's transformer, esbuild, downloads its platform binary in a `postinstall`, so without that file the very first `pnpm install` stops. The other package managers don't need it, and neither does an app scaffolded with `--workspace` — it answers to the workspace root's file.

## Addons

Six optional extras, available on either template. Each has a pair of flags — `--tailwind` / `--no-tailwind` — so a non-interactive run can turn one on or off explicitly. Anything a flag doesn't answer falls back to the default, which is Tailwind on and the rest off.

| Addon         | Flag             | What it adds                                                                                              |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `tailwind`    | `--tailwind`     | `@tailwindcss/vite` in the Vite config, utilities in place of hand-written CSS                            |
| `primitives`  | `--primitives`   | [`@implementjs/primitives`](/primitives) — the counter's links move into a `Collapsible`                  |
| `ui`          | `--ui`           | [`@implementjs/ui`](/ui) — a jsrepo config, the design tokens, and a styled `Button` in the counter       |
| `icons`       | `--icons`        | [`@implementjs/lucide`](/lucide) — the counter's buttons become `PlusIcon` and `MinusIcon`                |
| `forms`       | `--forms`        | [`@implementjs/formish`](/formish) and valibot — a validated sign up form under the counter               |
| `modeWatcher` | `--mode-watcher` | [`@implementjs/mode-watcher`](/mode-watcher) — a light and a dark palette, and a toggle under the counter |

Without Tailwind the generated `app.css` defines plain semantic classes (`.page`, `.counter`, `.button`) and the components reference them by the same names, so the two versions of the counter read identically.

An addon shapes what the templates write, so it is a choice you make while scaffolding. Config that stands on its own — linting, formatting — is an [adder](/create/adders) instead, and can be added to the app whenever you want it.

### The ui addon

`--ui` is the only addon that isn't a dependency. [`@implementjs/ui`](/ui) is a [jsrepo](https://jsrepo.dev) registry of styled components you copy into your project, so what the CLI writes is the setup those copies need:

```
my-app/
├ src/
│  ├ lib/
│  │  └ components/
│  │     └ ui/       where `jsrepo add` puts a component
│  └ app.css         the tokens every component reads
└ jsrepo.config.ts   which registry, and where its items land
```

It also puts `jsrepo` and `tailwind-variants` in `package.json`, along with a `ui` script — `pnpm ui dialog select` adds two more components. Because the styled components are Tailwind classes over the primitives, picking `ui` turns on `tailwind` and `primitives` even against a `--no-` flag.

`app.css` is the part that has to be right before anything renders: the components never name a color, so the `:root` values and the `@theme inline` block that turns each one into a Tailwind color are what make `bg-primary` and `ring-ring/50` mean something. [The registry's introduction](/ui) walks through it, including how to re-theme.

With `--install` the CLI finishes by running `jsrepo add button`, so the counter — which renders the styled `Button` rather than a bare element — works on the first `dev`. Without it, the next steps printed at the end of the run name the command.

The mode-watcher addon is the one that changes the palette rather than adding to it: the app starts light, `src/lib/mode.ts` (or `src/mode.ts` on the CSR template) holds the manager and the toggle, and `ModeWatcher` is mounted once at the root — in the kit layout, or next to the app in the CSR entry. With Tailwind the generated `app.css` points the `dark:` variant at the class on `<html>`; without it, a `.dark` block redefines the same custom properties the light one does.
