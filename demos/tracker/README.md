# tracker

An [implement](https://github.com/ieedan/implement) app on [`@implementjs/kit`](https://github.com/ieedan/implement/tree/main/packages/kit) — file
based routing, server rendering in dev, and a prerendered static site on build.

Addons: tailwind, primitives, icons

## Scripts

| Script    | What it does                                  |
| --------- | --------------------------------------------- |
| `dev`     | Start the dev server (server rendered, HMR)   |
| `build`   | Prerender the site into `dist/`               |
| `preview` | Serve the build locally                       |
| `sync`    | Regenerate `.implement/` without running vite |
| `check`   | Sync, then typecheck the app                  |

## Structure

```
tracker/
├ src/
│  ├ lib/            @/lib — components, helpers, state
│  ├ routes/         the routing tree
│  │  ├ about/
│  │  │  └ index.ts  → /about
│  │  ├ error.ts     the 404 / render error page
│  │  ├ index.ts     → /
│  │  └ layout.ts    wraps every page
│  ├ app.css         global styles, imported from the root layout
│  └ index.html      the shell, pointed at the generated client entry
└ static/            served from the site root
```

`index.ts` is a page, `layout.ts` wraps everything below it, and `[param]` / `[...rest]`
directories bind params. Kit generates `.implement/` (entries, the tsconfig this app extends, and
a `./$types` for every route) — it is gitignored and regenerates itself, so nothing in there
needs editing.
