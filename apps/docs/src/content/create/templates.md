---
title: Templates
description: The two starting points, and the addons you can layer on either one.
section: Start Here
order: 2
---

Pick a template with `--template` (`-t`), or let the CLI prompt you. Both templates render the same counter page, so what differs is the shape of the project, not the demo.

## implement-kit

`--template kit` — the default. A full-stack app on [`@implementjs/kit`](/kit): file-based routing, server rendering in dev, and a prerendered static site on build.

```
my-app/
├ scripts/
│  └ sync.ts         regenerates .implement/ without running vite
├ src/
│  ├ lib/
│  │  └ counter.ts   @/lib — components, helpers, state
│  ├ routes/
│  │  ├ about/
│  │  │  └ index.ts  → /about
│  │  ├ error.ts     the 404 / render error page
│  │  ├ index.ts     → /
│  │  └ layout.ts    wraps every page
│  ├ app.css         global styles, imported from the root layout
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
| `check`   | Sync, then typecheck the app                  |

Kit generates `.implement/` — the client and server entries, the tsconfig the app extends, and a `./$types` for every route. It's gitignored and regenerates itself, so nothing in there needs editing. Because a fresh clone has never run Vite, `check` runs `sync` first; `--install` runs it for you once the dependencies are in place.

## CSR with vite

`--template csr` — a client-rendered single page app on plain Vite, with no framework plugin at all.

```
my-app/
├ src/             the vite root
│  ├ app.css       global styles
│  ├ counter.ts    the component the page renders
│  ├ index.html    the page vite serves
│  └ index.ts      mounts the app into #root
├ tsconfig.json
└ vite.config.ts
```

| Script    | What it does                       |
| --------- | ---------------------------------- |
| `dev`     | Start the dev server with HMR      |
| `build`   | Build the static site into `dist/` |
| `preview` | Serve the build locally            |
| `check`   | Typecheck the app                  |

The whole app lives under `src/`, including `index.html`, so the generated Vite config sets `root: "src"` and points the build back at `dist/`. `src/index.ts` creates the app, mounts the counter, and carries the [four-line HMR block](/docs/vite).

## Addons

Three optional extras, available on either template. Each has a pair of flags — `--tailwind` / `--no-tailwind` — so a non-interactive run can turn one on or off explicitly. Anything a flag doesn't answer falls back to the default, which is Tailwind on and the other two off.

| Addon        | Flag           | What it adds                                                          |
| ------------ | -------------- | --------------------------------------------------------------------- |
| `tailwind`   | `--tailwind`   | `@tailwindcss/vite` in the Vite config, utilities in place of hand-written CSS |
| `primitives` | `--primitives` | [`@implementjs/primitives`](/primitives) — the counter's links move into a `Collapsible` |
| `icons`      | `--icons`      | [`@implementjs/lucide`](/lucide) — the counter's buttons become `PlusIcon` and `MinusIcon` |

Without Tailwind the generated `app.css` defines plain semantic classes (`.page`, `.counter`, `.button`) and the components reference them by the same names, so the two versions of the counter read identically.
