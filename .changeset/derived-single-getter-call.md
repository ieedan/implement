---
"@implementjs/core": patch
---

A `derived` no longer runs its getter more than once to start listening, and no longer runs it at construction. `Await` over a `derived` whose getter returns a promise now starts one request per source value instead of three to five.
