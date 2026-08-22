# Papercuts

Sharp edges on things that exist. Missing features live in
[MISSING.md](MISSING.md).

## 1. `derived` of a promise-producing getter over-fetches

`Derived` recomputes `read()` on **every** `get()` while it has no
subscribers, and `Await` calls `source.get()` a few times during
construction and mount — so the natural
`derived([id], (id) => api.comments.list({ id }))` fires 3–4 duplicate
network requests before settling. Getters are clearly meant to be pure, but
promise-producing getters are exactly what `Await`'s readable overload
invites you to write.

## 2. Implementing `Writable` from outside is not realistic

The router's `searchParam` wants to be a `Writable<string>` view over the
URL. Implementing the actual interface means reproducing the three-overload
`bind` zoo and `flush`; instead it returns `Readable<string> & { set }`,
which two-way binds to `Input` only because `isWritable` duck-checks at
runtime. It works, but the type system and the runtime disagree about what a
"writable" is.

The same shape used to hold for `IMountable`: public interface, not actually
implementable from outside, because the parent link that context and error
boundaries walk is written by `mountChild` and nothing exported reached it.
That one is closed — `Outlet` publishes the region primitive, so a node
mounts children through core rather than around it. `Writable` is now the
remaining "public interface you cannot really implement".

## 3. The route table and the views want each other

Concept-A routing means `router.ts` imports every view to build the table,
while views import `router` for `Link`/`navigate`/`searchParam`. The ESM
cycle resolves only because views touch `router` inside function bodies; one
top-level `router.href(...)` in a view module would crash at load.
(`@implementjs/kit` file routes avoid this; the core `Router` table does
not.)
