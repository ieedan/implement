---
"@implementjs/kit": patch
---

Fix an app with a param matcher losing every type it gets from `@implementjs/router` — `router.Link` included. The `ParamTypes` block filling in the matchers' types was written into `$implement.d.ts`, which is a script (no top-level `import` or `export`), and there a `declare module "@implementjs/router"` is an _ambient module declaration_ that takes the package's name over rather than augmenting it. Nothing errored: the package's own exports simply stopped existing, so `RouterHelper` resolved to nothing, `router` collapsed to `any`, and `to`, `params`, `Router`, and `RouterError` went unchecked along with it. The augmentation now goes to `.implement/types/$implement-params.d.ts`, a module, and is removed again when the last matcher does — `$implement.d.ts` stays a script, which its own `declare module "$implement/*"` blocks and `declare namespace App` require.
