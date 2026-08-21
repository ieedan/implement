# implement

Just some experimentation.

## The `@implementjs/ui` registry

`apps/docs/jsrepo.config.ts` defines the [jsrepo](https://jsrepo.dev) registry the styled components ship as — one item per file in `apps/docs/src/lib/components/ui/`, plus the `cn` in `apps/docs/src/lib/utils.ts` that they all import. It lives in the docs app rather than here so that it resolves against the project the sources belong to: the `@/` alias they import `cn` through, and the `package.json` the versions of what they pull in come from.

```sh
pnpm registry
```

That rebuilds `apps/docs/registry.json`, which is committed: it is the manifest a checkout is read through, whether over git or off disk with the `fs` provider. CI rebuilds it and fails if it drifted, so run it after adding or renaming a component.

`create-implement-app --ui --link .` scaffolds an app that reads this checkout's registry directly.

## TODOS

- rewrite all docs
- new homepage
- unslop all the code docs
