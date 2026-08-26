---
"@implementjs/kit": patch
"@implementjs/vite": patch
---

`api.openapi.output` writes its file whatever `prerender` is set to.

The document was written from inside the prerender pass's `after` hook, which is
never reached with `prerender: false`. An app that turned prerendering off got
no file, no warning, and a build that still exited 0 — and `prerender: false` is
the normal setting for an app whose pages sit behind a session, which is exactly
the kind of app that wants a documented API.

`@implementjs/vite` grows a `build` hook that runs with the SSR module runner
open, ahead of the prerender and whether or not there is one, and kit writes the
document from there. The runner is opened for that hook alone when prerendering
is off, so a build with no document to write pays nothing for it. Route data
payloads and prerendered endpoints still come from `after`, which is where they
belong: those _are_ the prerender's output.

```ts
kit({
	adapter: adapter(),
	prerender: false,
	api: {
		openapi: { info: { title: "x", version: "1" }, output: "static/openapi.json" },
	},
});
```

`vite build` now writes `static/openapi.json`, copies it into the build's own
output when `output` lands under the public dir, and names it to the adapter
alongside everything else the build produced.
