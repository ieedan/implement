# Papercuts

Sharp edges hit while implementing the router and building `demos/tracker`
on top of it. Missing features live in [MISSING.md](MISSING.md); this file
is about what exists but cut me.
Items marked **(fixed)** were fixed in the framework during this build —
they're recorded because the next subsystem will hit the same class of bug.

## 1. `Signal.set` silently swallowed promise updates **(fixed)**

`hasChanged` uses fast-deep-equal, and two distinct `Promise`s deep-equal as
empty objects — so `querySignal.set(newPromise)` never notified anyone. That
made `Await`'s documented readable re-follow (**the** router data pattern:
swap the promise, `Await` patches in place) physically impossible: the update
died inside `set`. Same family as the existing Map/Set special case in
`hasChanged`; thenables now also compare by reference only. Anything else that
deep-equals as `{}` (DOM nodes, class instances without enumerable fields)
will ambush someone the same way — deep-equal-by-default on `set` is a trap
for every non-plain-data signal.

## 2. `Bindable<T>` distributed away `Readable<boolean>` **(fixed)**

`Bindable<T>` distributed over unions, so `Bindable<boolean>` meant
`true | false | Readable<true> | Readable<false>` — and
`disabled: derived([title], t => t === "")` (a `Readable<boolean>`) failed to
typecheck on the framework's own `disabled` prop. The type now also keeps the
undistributed `Readable<T>`.

## 3. `Readable<unknown>` is not "any readable" **(fixed in helpers)**

`Readable`'s `bind` overloads (conditional types over `BindableKeys<T>`) make
the interface effectively invariant: `Signal<boolean>` — and even the
framework's own `Derived<boolean>` — was **not** assignable to
`Readable<unknown>`. Since `If`'s condition parameter was
`boolean | Readable<unknown>`, passing any real signal to `If`/`Key` was a
type error. The helpers now take `Readable<any>` (and need `isReadable<any>`
for narrowing, because the default type argument no longer narrows the
union). Userland APIs that want "any readable" will keep tripping on this
until the variance is designed on purpose.

## 4. `isReadable` / `isWritable` weren't exported **(fixed)**

The "accept a plain value or a Readable" picker pattern needs `isReadable`
at the call site. It existed in `signal.ts` but wasn't in the package
index, so userland couldn't write maybe-reactive APIs at all.

## 5. The route-table type can't be inferred the obvious way

`function Router<T>(routes: Routes<T>)` (reverse mapped-type inference — the
shape the original stub used) infers `T` with `unknown` leaves because the
conditional template blocks inference, which collapsed the typed-path union
to `"/"` — every `href`/`Link` call outside the root failed. The working
shape is the recursive constraint `Router<T extends Routes<T>>(routes: T)`,
which keeps both the literal structure _and_ contextual typing of the
callbacks. Worth remembering for any future config-tree API (the same trap
will bite a typed store or form schema).

## 6. `derived` of a promise-producing getter over-fetches

`Derived` recomputes `read()` on **every** `get()` while it has no
subscribers, and `Await` calls `source.get()` a few times during
construction and mount — so the natural
`derived([id], (id) => api.comments.list({ id }))` fires 3–4 duplicate
network requests before settling. Tracker's comments section had to use a
`signal`-of-promise plus explicit `refetch()` instead. Getters are clearly
meant to be pure, but promise-producing getters are exactly what `Await`'s
readable overload invites you to write.

## 7. Subscriptions created in component bodies leak **(fixed)**

A `watch(...)`/`id.onChange(...)` made while building a component used to
outlive it forever. `Implement.Lifecycle` now owns these: return the
unsubscribe from `onMount` and it runs on unmount. The detail view's
"reseed the title draft when the routed `:id` changes in place" does
exactly this; the demo's hand-rolled `Effect` mountable is deleted.

## 8. Implementing `Writable` from outside is not realistic

The router's `searchParam` wants to be a `Writable<string>` view over the
URL. Implementing the actual interface means reproducing the three-overload
`bind` zoo and `flush`; instead it returns `Readable<string> & { set }`,
which two-way binds to `Input` only because `isWritable` duck-checks at
runtime. It works, but the type system and the runtime disagree about what a
"writable" is.

## 9. Wrapper components can't forward reactive `class`

`PrimaryButton` wants `cx(base, props.class)`. `props.class` is
`Bindable<string | null | undefined>`, and `cx` needs a string — so wrappers
either narrow to static strings (what tracker does) or re-implement
subscription plumbing per prop. Userland components need a "normalize a
maybe-reactive prop" helper from the framework.

## 10. The route table and the views want each other

Concept-A routing means `router.ts` imports every view to build the table,
while views import `router` for `Link`/`navigate`/`searchParam`. The ESM
cycle resolves only because views touch `router` inside function bodies; one
top-level `router.href(...)` in a view module would crash at load. First-class
route objects (Concept D) are the structural fix.

## 11. The router fallback bypasses layouts

`Router(routes, { fallback })` replaces the whole tree, so the 404 page
renders without the app shell (no sidebar). Reasonable default for a demo,
surprising in an app — a not-found _route_ under the root layout can't be
expressed without a catch-all segment type.

## 12. `watch` still fires immediately

`watch(signals, fn)` runs `fn` at subscribe time. The comments refetch
logic had to use `onChange` instead — the `{ immediate: false }` option (or
doc note) still doesn't exist.
