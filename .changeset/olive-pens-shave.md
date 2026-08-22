---
"@implementjs/adapter-cloudflare": patch
"@implementjs/adapter-node": patch
"@implementjs/adapter-static": patch
"@implementjs/adapter-vercel": patch
"@implementjs/core": patch
"@implementjs/kit": patch
"@implementjs/router": patch
"create-implement-app": patch
---

Publish the node-authoring API and extract the router.

`@implementjs/core` gains `Outlet`, a swappable mount region whose children are mounted
through core — so context lookups, error boundaries, hydration and server rendering all
work inside one — and `location`, the current `RouterLocation` as a `Readable`. Core also
restores the scroll position of the entry a reload landed on off the first location
subscription, so a hand-written router gets that for free.

`Router` moves to the new `@implementjs/router`, written against that public API and
nothing else. `@implementjs/core/router` is gone; navigation stays in core (`location`,
`navigateTo`, `searchParam`, the navigation guards and the resolver).

kit generates `import { Router } from "@implementjs/router"` and takes it as a dependency,
and scaffolded kit apps list it too — generated code resolves from the app, not from kit.
