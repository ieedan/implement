---
"@implementjs/core": patch
---

Fix a path bind throwing when the value it reads through is missing. `getAtPath` treated a `null` or `undefined` along the path as an error, so `data.bind("issue").bind("title")` — or the equivalent `data.bind("issue.title")` — threw `Cannot read "title" from undefined` while the load was still in flight, taking the component down for a value that arrives a tick later. The same applied to `ref.bind("disabled")` before the node mounted. A path now reads through a missing value the way optional chaining does, reading `undefined` and updating when the value lands, which is also what the path types describe: `PathsOf` walks `NonNullable`, so binding through an optional field is the case they were written for. Writes still throw — a write has nowhere to land, rather than merely nothing to read — and now name the segment that was missing.
