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

## Releasing

Versions and changelogs are managed by [changesets](https://changesets.dev). A branch that
changes a package carries a changeset describing the change, committed alongside the code:

```sh
pnpm changeset
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) picks those up on merge. With
changesets pending it opens a `chore: version packages` pull request that applies the bumps,
writes the `CHANGELOG.md` files and deletes the changesets; merging that pull request publishes
whatever the registry has not seen yet. Each changelog entry links back to the pull request its
changeset arrived in, which is why the workflow checks out the full history: the link is found
by tracing the changeset file to the commit that added it.

### Patch only, for now

The packages are on `0.0.x`, so the next release is `0.0.1` and `patch` is the only bump a
changeset may ask for. A `minor` would publish `0.1.0` and a `major` would publish `1.0.0`, and
a version number cannot be taken back once the registry has it.

[`scripts/check-changesets.ts`](scripts/check-changesets.ts) is what holds that line. It reads
the changesets out of the git index, so it sees what is actually being committed rather than
what happens to be on disk. Run it over the whole directory by hand with:

```sh
pnpm check:changesets --all
```

It runs in three places, in increasing order of how much they can be relied on:

| Where                                                        | Catches                                              |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| [`.githooks/pre-commit`](.githooks/pre-commit)               | your own commit, before it exists                    |
| the `Changesets` job in [`ci.yml`](.github/workflows/ci.yml) | anything reaching a pull request                     |
| a step in [`release.yml`](.github/workflows/release.yml)     | anything reaching `changeset version`, from anywhere |

The hook is the convenience, not the guarantee. Git will not run a hook out of a fresh clone,
by design, so an agent that clones and commits without installing has none. The root `prepare`
script points `core.hooksPath` at the tracked `.githooks` directory, which means one
`pnpm install` is enough to get it and the hook itself is reviewable in the repo rather than
sitting untracked in `.git`. What actually stops a bad changeset from being published is the
step in the release workflow, which runs before `changeset version` and does not care where the
commit came from.

When the version line really does move, raise `ALLOWED_BUMPS` in the script.

## TODOS

- rewrite all docs
- new homepage
- unslop all the code docs
