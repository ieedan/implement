---
"@implementjs/kit": patch
---

Pre-bundle the deps that only kit's generated modules import, so dev stops answering with `504 (Outdated Optimize Dep)`. Vite's dep scanner externalizes virtual modules, so its startup crawl stopped at `$implement/router` and never saw what hangs off it — the route modules, the param matchers, or `@implementjs/router` and `@implementjs/kit/params` themselves. The browser discovered them instead on first load, which re-bundles, moves every optimized URL's `?v=` hash, and kills the requests already in flight. The plugin now points the scan at the real files behind those virtual modules (`page.ts`, `layout.ts`, their `@` reset variants, `error.ts`, and `src/params/*.ts`) and names kit's own imports in `optimizeDeps.include`, so an app no longer has to declare them in its own `vite.config.ts`. Server files stay out of it: a dep only a `*.server.ts` imports is still no business of the browser's pre-bundle.
