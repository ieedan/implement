# `@implementjs/ui`

There is no code here. This package exists so that changesets can version the
[jsrepo](https://jsrepo.dev) registry the styled components ship as, the same way it versions
everything else in the workspace — `pnpm changeset` lists `@implementjs/ui`, `changeset version`
bumps the `version` below and writes `CHANGELOG.md` beside it, and
[`apps/docs/jsrepo.config.ts`](../../apps/docs/jsrepo.config.ts) reads that version when it builds
and publishes the registry.

It is `private`, so it never reaches npm. `@implementjs/ui` is a registry, not a package:
`jsrepo add @implementjs/ui/button` copies a component's source into your project rather than
installing anything.

The components are `apps/docs/src/lib/components/ui/`, and the registry that collects them is
configured from the docs app so that it resolves against the project the sources belong to — the
`@/` alias they import `cn` through, and the `package.json` the versions of what they pull in come
from. [The repository README](../../README.md#the-implementjsui-registry) has the rest.
