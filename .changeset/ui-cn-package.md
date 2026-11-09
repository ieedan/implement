---
"@implementjs/ui": patch
"create-implement-app": patch
---

`cn` is now the `@implementjs/cn` package instead of a `utils.ts` copied into your project, so a fix to it arrives with a version bump rather than a diff. Components import it from the package and jsrepo installs it with the first one you add; the `ui` addon adds `@implementjs/cn` in place of `tailwind-merge`, and no longer sets a `lib` path in `jsrepo.config.ts`.

Already have `src/lib/utils.ts` from an earlier release? Components added from now on import `@implementjs/cn`, and the old file is safe to delete once none of your own components import it.
