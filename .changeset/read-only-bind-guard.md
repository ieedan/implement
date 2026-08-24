---
"@implementjs/core": patch
---

Throw on `bind(selector, update)` against a read-only source, instead of
silently dropping the write-back.

The guard existed in `createBinding`, but nothing could reach it: the read-only
`bind` implementations on `Derived`, `SelectorView`, `ReactiveSet` and
`ReactiveMap` declared a single parameter, so `update` was discarded and the
call returned a plain `Readable`.

That is the exact call a mistake produces. A component prop typed `Signal<T>`
is filled with a route's `data`, or something bound off it, which is read-only
at runtime; the component then asks for a two-way view and gets a readable
back. The failure surfaced much later and unrecognizably — a primitive doing
`signal(props.value)` wrapped the readable itself, and a selector reading
through it blew up on the readable object rather than the array it expected.
The error now names the call that was wrong.
