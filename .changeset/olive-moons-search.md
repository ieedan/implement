---
"@implementjs/core": patch
---

Add `mediaQuery(query, { fallback })`, a CSS media query as a `Readable<boolean>`.
It listens only while something is listening to it, and reports the fallback on
the server — and through hydration, so the pass matches the markup the server
produced instead of throwing it out and re-rendering.
