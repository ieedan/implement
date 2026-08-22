# implement

Just some experimentation.

## The `@implementjs/ui` registry

`apps/docs/jsrepo.config.ts` defines the [jsrepo](https://jsrepo.dev) registry the styled components ship as — one item per file in `apps/docs/src/lib/components/ui/`, plus the `cn` in `apps/docs/src/lib/utils.ts` that they all import. It lives in the docs app rather than here so that it resolves against the project the sources belong to: the `@/` alias they import `cn` through, and the `package.json` the versions of what they pull in come from.

```sh
pnpm registry
```

That rebuilds `apps/docs/registry.json`, which is committed: it is the manifest a checkout is read through, whether over git or off disk with the `fs` provider. CI rebuilds it and fails if it drifted, so run it after adding or renaming a component.

`create-implement-app --ui --link .` scaffolds an app that reads this checkout's registry directly.

## Deploying the docs

`apps/docs` builds for Vercel through [`@implementjs/adapter-vercel`](packages/adapter-vercel) — the docs are its dogfood. `vite build` writes [Build Output API v3](https://vercel.com/docs/build-output-api/v3) into `apps/docs/.vercel/output`: everything prerendered as static files on the CDN, and the app as a bundled Node function behind them for whatever the filesystem misses.

The Vercel project needs one setting — **Root Directory: `apps/docs`** — and takes the rest from `apps/docs/vercel.json`. The build command generates the Lucide icon modules before building, since `packages/lucide/src/` is generated and not committed.

The site stays fully prerendered (`prerender: { default: true }` in `apps/docs/vite.config.ts`). A server adapter otherwise defaults to `"auto"`, which leaves every page with a server load to render per request — and `/packages` reads the workspace manifests off disk, a path that does not exist inside the uploaded function.

One consequence worth knowing: Vercel serves the prerendered documents straight off the filesystem, so the `Accept: text/markdown` redirect in `hooks.server.ts` only fires for paths the CDN has no file for. The `.md` twins are still there to link and fetch directly.

```sh
pnpm --filter @apps/docs build
cd apps/docs && vercel deploy --prebuilt
```

## TODOS

- rewrite all docs
- new homepage
- unslop all the code docs
