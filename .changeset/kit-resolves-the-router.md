---
"@implementjs/kit": patch
---

Resolve `@implementjs/router` from kit rather than from the app. The generated `$implement/router` module imports the router by name and `$implement-params.d.ts` augments its `ParamTypes`, both from inside the app — so until now the app had to depend on the package to make either resolve, and could drift onto a different copy than the one kit generated against. Kit now aliases the name at its own copy in both Vite and the generated tsconfig, which an app's own `alias` entries still override.
