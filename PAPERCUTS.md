# Papercuts

Things that exist but bothered me or behaved unexpectedly while building
`demos/tracker`. Missing features live in [MISSING.md](MISSING.md); this file
is about sharp edges on what's already there.

## 2. `Component` is invariant — there is no "any component" type

`Component<"button">` is not assignable to `Component<keyof HTMLElementTagNameMap>`
(the `ref`/element types make it invariant). Tracker's `Menu` takes a trigger
component and had to type it `Component<any>`. A supertype interface (element
covariant, or an `AnyComponent` alias) would let containers accept components
without `any`.

## 3. `If` builds children eagerly and keeps them alive

Children are constructed at `If(...)` construction and only mounted/unmounted.
The create-issue dialog therefore exists (with all its menus and subscriptions)
before it's ever opened, and state persists across open/close — tracker needs
an explicit `openCreateDialog()` that resets every form signal. There's no lazy
`If(cond, () => build())` form.

## 5. `watch`/`subscribe` fire immediately

`subscribe(signals, getter)` invokes the getter once at subscribe time to
populate values. Most frameworks' `watch` semantics are "on change only", so my
first keyboard-shortcut effect ran at startup. Fine once known, but it deserves
a doc note (or an `{ immediate: false }` option).

## 7. Wrapping components means re-implementing the overload zoo

Every built-in prop accepts `value | Readable<V> | [signals, getter]` via three
overloads. Great to use — but the moment you write your own component that
forwards a prop (tracker's `TextArea`, `Icon`, buttons), you either give up the
flexibility (accept only `Signal`) or copy the triple-overload pattern and
`bindProperty` logic, which is `protected` inside `Component` and not reusable
from the outside. Exporting a helper for "normalize a maybe-reactive prop"
would make userland components first-class citizens.

## 8. Coarse re-rendering shows up as UX bugs, not just perf

Because any change to an issue rebuilds the whole detail view:

- the labels multi-select menu closes after each toggle even with
  `keepOpen: true` (its DOM was rebuilt),
- an in-progress comment draft would be lost if someone changed the issue's
  status mid-typing,
- comments refetch after unrelated field edits.

The framework gives no tools to isolate those subtrees short of restructuring
all state into per-field signals.

## 9. Repo/config friction

- The oxlint config hard-coded `demos/todo/src/api/**` ignores; every new demo
  has to remember to generalize it (I changed it to `demos/*/src/api/**`, same
  for `.gitignore`). Glob by convention up front.
- `@hey-api/openapi-ts` is pinned to a `0.0.0-next-*` snapshot; anyone adding a
  demo copies a moving target.
- The whole per-demo scaffold (package.json scripts, tsdown/tailwind/openapi
  configs, index.html) is copy-paste between demos with only ports changing —
  it wants to be a template or shared preset.
