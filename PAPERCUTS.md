# Papercuts

Things that exist but bothered me or behaved unexpectedly while building
`demos/tracker`. Missing features live in [MISSING.md](MISSING.md); this file
is about sharp edges on what's already there.

## 1. `Signal.set` change detection is inverted — it always notifies ✅ Done

**Done.** `set` now notifies only when `prev !== next && !equal(prev, next)`
(Maps/Sets compare by identity, since `fast-deep-equal` ignores their contents).

```ts
// signal.ts
const changed = this.value !== value || equal(this.value, value);
```

Truth table: same reference → `false || true` → notify. Deep-equal copy →
`true || true` → notify. Different value → `true || false` → notify. So **every
`set()` notifies every subscriber unconditionally**. The condition wants to be
`this.value !== value && !equal(this.value, value)`. The code comment ("keep an
eye on this one…") suggests this was already suspected. Downstream effects:
`subscribeTracked` re-runs bindings on no-op sets, and `Derived` recomputes on
every source set. (`subscribe()` happens to mask it for components because it
does its own `!==` check per signal — which conversely means deep-equal-but-
new-reference values _don't_ propagate there. The two layers disagree about
what "changed" means.)

## 2. `Derived` of an array always notifies ✅ Done

**Done.** `Derived` uses the same `hasChanged` guard as `Signal.set`, so a getter
that returns a fresh but deep-equal array/object no longer notifies.

`Derived` guards with `this.value === next`, so any getter returning a fresh
array/object notifies on every source change even when the contents are
identical. Tracker's `groups` derived rebuilds on each keystroke in search
even when the filtered result is the same. Combined with #1, a no-op
`issues.set(issues.get())` cascades through every Derived and every ForEach in
the app. A deep-equality (or configurable equality) guard would stop the noise
at the source.

## 3. `ForEach`'s render signature lies ✅ Done

**Done.** The render callback is now `(entry: Readable<[T, number]>) => Mountable`,
and ForEach actually passes a `Signal` that it patches in place when a keyed
child already exists (see MISSING #11).

The callback is typed `Getter<Mountable, [Signal<[T, number]>]>` — it claims
you receive a `Signal` of item+index, but the implementation calls
`this.render([currentVal, i])` with a plain tuple. Destructuring
`([item]) => ...` works at runtime but the types say `item` is... whatever a
Signal's first tuple element is. It typechecks by accident and confused me
until I read the source. Either actually pass a signal (enabling row patching,
see MISSING #11) or type it honestly as `(entry: [T, number]) => Mountable`.

## 4. Keying is easy to get silently wrong

- Keys only work if the render callback returns a `Component` with `.key()`
  chained; return a `Fragment`/`If`/anything else and ForEach silently falls
  back to index keys — reordering bugs appear with no warning.
- Forgetting `.key()` entirely is also silent.
- Duplicate keys _do_ throw, but at mount time from deep inside a subscriber,
  so the stack trace points at a `set()` call, not at the offending render.

## 5. `Component` is invariant — there is no "any component" type

`Component<"button">` is not assignable to `Component<keyof HTMLElementTagNameMap>`
(the `ref`/element types make it invariant). Tracker's `Menu` takes a trigger
component and had to type it `Component<any>`. A supertype interface (element
covariant, or an `AnyComponent` alias) would let containers accept components
without `any`.

## 6. `If` builds children eagerly and keeps them alive

Children are constructed at `If(...)` construction and only mounted/unmounted.
The create-issue dialog therefore exists (with all its menus and subscriptions)
before it's ever opened, and state persists across open/close — tracker needs
an explicit `openCreateDialog()` that resets every form signal. There's no lazy
`If(cond, () => build())` form.

## 7. `Context.Use` reads once and never updates

The `render` callback runs on first mount and the child is cached; if the
provided value could change, consumers won't see it. It's fine for injecting a
store object, but it looks reactive and isn't — worth documenting or making it
re-render on remount.

## 8. `watch`/`subscribe` fire immediately

`subscribe(signals, getter)` invokes the getter once at subscribe time to
populate values. Most frameworks' `watch` semantics are "on change only", so my
first keyboard-shortcut effect ran at startup. Fine once known, but it deserves
a doc note (or an `{ immediate: false }` option).

## 9. `Await.Then` hands you a `Signal<T>` you'll never write

The resolved value arrives wrapped in a `Signal`, but nothing ever sets it
again (the promise resolved once), so every `.Then()` starts with
`value.get()`. The wrapping implies a reactivity that doesn't exist. Passing
`T` directly would match what the helper actually does.

## 10. No `Signal.update(fn)` ✅ Done

**Done.** `Signal.update(fn)` applies `fn` to the current value and `set`s the
result, so store patches no longer need the `get()`/`set()` dance.

The array helpers (`push`, `splice`, …) are nice, but the most common store
operation in tracker is "map over the array replacing one element":

```ts
issues.set(issues.get().map((i) => (i.id === id ? { ...i, ...patch } : i)));
```

An `update(fn: (current: T) => T)` would remove the `get()`/`set()` dance that
appears ~10 times in one store file.

## 11. Wrapping components means re-implementing the overload zoo

Every built-in prop accepts `value | Readable<V> | [signals, getter]` via three
overloads. Great to use — but the moment you write your own component that
forwards a prop (tracker's `TextArea`, `Icon`, buttons), you either give up the
flexibility (accept only `Signal`) or copy the triple-overload pattern and
`bindProperty` logic, which is `protected` inside `Component` and not reusable
from the outside. Exporting a helper for "normalize a maybe-reactive prop"
would make userland components first-class citizens.

## 12. `content()` uses `innerText` ✅ Done

**Done.** `content()` writes `textContent` instead of `innerText`.

`innerText` reads force layout and honor CSS (`text-transform`, `display`) in
surprising ways; `textContent` is almost always what a framework wants here.

## 13. Coarse re-rendering shows up as UX bugs, not just perf

Because any change to an issue rebuilds the whole detail view (see MISSING #6/#11):

- the labels multi-select menu closes after each toggle even with
  `keepOpen: true` (its DOM was rebuilt),
- an in-progress comment draft would be lost if someone changed the issue's
  status mid-typing,
- comments refetch after unrelated field edits.

The framework gives no tools to isolate those subtrees short of restructuring
all state into per-field signals.

## 14. Repo/config friction

- The oxlint config hard-coded `demos/todo/src/api/**` ignores; every new demo
  has to remember to generalize it (I changed it to `demos/*/src/api/**`, same
  for `.gitignore`). Glob by convention up front.
- `@hey-api/openapi-ts` is pinned to a `0.0.0-next-*` snapshot; anyone adding a
  demo copies a moving target.
- The whole per-demo scaffold (package.json scripts, tsdown/tailwind/openapi
  configs, index.html) is copy-paste between demos with only ports changing —
  it wants to be a template or shared preset.
