---
"@implementjs/core": patch
---

Say so when a readable child is holding a node, and name `Dynamic`.

A readable child _is_ the text-node shape, so `Span({}, icon)` where `icon` is a
`Readable<Mountable>` stringifies the node — `[object Object]` where the glyph
should be — rather than mounting it. Nothing about the failure pointed at the
helper that does the job: the type error came out of the `Child` union, and the
rendered output said nothing at all.

A readable child that resolves to a mountable, a mounted node, or a raw DOM node
now warns in development, with the `Dynamic` call that fixes it. The check is
deliberately narrow — a `Date`, or anything else with a `toString` worth reading,
is text somebody may well have meant — and reports one mistake once, however many
updates the signal behind it goes on to drive. `Dynamic`, `Child` and
`ReadableChild` say the same thing in their doc comments, and the
[If](https://implementjs.dev/docs/if) page now covers the case where it is the
node itself that comes out of a signal.
