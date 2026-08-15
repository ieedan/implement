# Missing

Things the framework does not have yet. Compiled while building `demos/tracker`
(a Linear-style issue tracker: sidebar views, grouped/filtered lists, dropdown
menus, a modal dialog, inline editing, comments). Roughly ordered by how much
each one hurt.

## 1. Arbitrary attribute bindings

There is no `.attr()` (or per-attribute methods beyond `id`/`class`). Nothing can set:

- `href` / `target` on `A` — links are unusable; every "link" in tracker is a `Button` calling the router
- `disabled` on buttons/inputs — faked with `pointer-events-none opacity-40` classes plus a guard in the click handler, which is wrong for keyboard users
- `aria-*` / `role` — every icon-only button in tracker is nameless to assistive tech (the accessibility tree is just anonymous `button` after `button`); there is currently **no way to build an accessible app**
- `title`, `tabindex`, `autocomplete`, `spellcheck`, `data-*`, `for` on labels, `colspan`, …

Suggested shape, consistent with existing bindings:
`.attr(name, value | Readable | [signals, getter])` plus `.aria(name, ...)` sugar.

## 2. Style bindings ✅ Done

> Implemented: `.style({ property: value | Readable })` on `Component` —
> Svelte-style, with keys typed from `CSSStyleDeclaration` (plus `--custom`
> properties). Readable values keep that property reactive; repeated calls
> merge. Tracker's `backgroundColor` ref hack (`lib/dom.ts`) is gone.

No `.style()`. Runtime values from data (user avatar colors, label dot colors
stored in the database) cannot become Tailwind classes because the class isn't
known at build time. Tracker works around it with refs:

```ts
Span().ref((el) => {
	if (el) el.style.backgroundColor = label.color;
});
```

That ref hack is write-once — it never updates if the color changes.

## 3. Value bindings for Textarea and Select ✅ Done

> Implemented: `Textarea` now has `.value()` (two-way, same overloads as
> Input), `.placeholder()`, and `.rows()`; `Select` has `.value()` (two-way on
> `change`, re-applied after its options mount). Tracker's `TextArea` helper is
> now a thin wrapper with no manual wiring or leaked subscription.

Only `Input` has `.value()` / `.checked()` / `.placeholder()`. `Textarea` and
`Select` are bare `Component`s. Tracker's description editor and comment
composer wire textareas manually (ref to set `value`/`placeholder`/`rows`, an
`input` listener, and a manually managed subscription that leaks — see
lifecycle below). Select is effectively unusable, which is partly why tracker
builds custom dropdown menus for everything.

## 4. Lifecycle hooks (onMount/onUnmount) ✅ Done

> Implemented: `.beforeMount(cb)`, `.afterMount((el) => …)`,
> `.beforeUnmount((el) => …)`, `.afterUnmount(cb)` on `Component`, firing once
> per mount cycle. Children now mount after their host is inserted, so nested
> `afterMount` hooks run attached (e.g. autofocus works). Tracker uses them for
> the dialog's Escape listener, the menu's outside-click cleanup, and the
> create-dialog autofocus.

There is no way for a component author to run setup/teardown when their subtree
mounts/unmounts. Consequences in tracker:

- The dropdown `Menu` attaches `document` listeners for outside-click/Escape.
  If a row is unmounted while its menu is open, the listeners linger until the
  next click. There is no unmount signal to clean up with.
- The `TextArea` helper subscribes to its value signal; that subscription can
  never be disposed, so every rebuilt issue-detail view leaks one.
- Autofocus needs `setTimeout(() => el?.focus(), 0)` from an external
  subscription instead of an `onMount`.

`.ref()` almost works as a mount signal (it fires with `null` on unmount) but
it's single-slot: a component that uses ref internally steals it from callers.

## 5. A router

Every app needs one. Tracker hand-rolls a hash router in ~25 lines
(`src/lib/router.ts`) — a `Signal<Route>` fed by `hashchange`. Fine for a demo,
but a first-class router with typed routes, a `Link` component (blocked on
`href` support, see #1), and scroll/focus handling belongs in the framework.

## 6. A way to re-render a subtree when data changes ("Switch"/keyed dynamic) ✅ Done

> Implemented as `Key(signal | [signals], (…values) => Mountable | null)` —
> tears down and rebuilds the returned subtree whenever the watched signal(s)
> change (`null` renders nothing). Tracker's `IssueDetailHost` now uses it
> instead of the single-item ForEach hack. A `Match`/`Switch` sugar for enums
> is still open (see #7).

`If` mounts/unmounts pre-built children; `ForEach` is list-shaped. There is
nothing for "render this function of a signal, rebuilding when it changes" —
needed for route → detail view. Tracker abuses a single-item `ForEach` as a
dynamic component:

```ts
const current = new Derived([route, issues], (r, list) => /* [] or [issue] */);
return ForEach(current, ([issue]) => IssueDetailView(issue));
```

It works because ForEach rebuilds on deep-inequality, but it's a hack standing
in for a real `Dynamic(signal, render)` / `Match` primitive.

## 7. If has no Else ✅ Done

> Implemented: the API is now `If(cond).Then(...components).Else(...components)`
> (children are no longer constructor args), with
> `.ElseIf(cond).Then(...components)` chains in between — the first branch whose
> condition holds is mounted. `If`/`ElseIf` also accept
> `boolean | Readable<unknown>` in one overload — a lone signal is checked for
> truthiness, so `If(user)` covers the `user !== null` case — plus the
> `[signals, getter]` form. For enums there is now
> `Switch(subject).Case(value, ...components).Default(...components)` — cases
> match by deep equality, each `Case` narrows the remaining union (duplicates
> are type errors), and a terminal `.Exhaustive()` fails to compile until every
> member of the union has a case.

Binary states need two `If` nodes with inverted conditions (double
subscription, easy to let them drift). `If(cond, ...).Else(...)` — and ideally
a `Match`/`Switch` for enums like issue status — would remove a lot of noise.

## 8. SVG support

`Component.create()` uses `document.createElement`, so SVG elements (which need
`createElementNS`) can't be components. All 25+ icons in tracker are raw SVG
strings injected via `.html()` — no type safety, no per-part reactivity, and
`innerHTML` re-parses on every change.

## 9. Portals + floating positioning — Portal ✅ Done

> Implemented: `Portal(...children).To(target)` mounts children into `target`
> (`document.body` when `.To()` is omitted) while keeping them in the logical
> tree — context,
> unmounting, and lifecycle hooks behave as if rendered in place. Tracker's
> `Dialog` now portals to body, so it no longer depends on ancestor stacking
> contexts. Collision-aware floating positioning for menus is still open.

Dialogs and menus render in place. The modal works only because it can use
`position: fixed` and nothing above it creates a stacking context — that's
luck, not design. Menus position with `absolute top-full` and clip at the
viewport edge (tracker's properties-panel menus had to be hard-coded
`align: "right"` after one clipped off-screen). A `Portal(target?)` helper plus
even minimal collision-aware positioning would cover 90% of real menus.

## 10. Derived ergonomics

- ✅ Done: `Derived` now accepts `Signals extends readonly Readable<any>[]`, so
  deriving from a `Derived` (or any `Readable`, e.g. a ForEach entry) typechecks.
- `Derived` subscribes to its sources forever; there is no way to dispose one.
  Creating Deriveds inside per-row/per-view components (as tracker does for
  menu selection state) leaks subscriptions on every rebuild.
- No function-style auto-tracked derived (`new Computed(() => ...)`) even
  though `subscribeTracked` already implements the tracking.

## 11. Fine-grained list updates ✅ Done

> Implemented: `ForEach`'s render callback now really receives a
> `Readable<[T, number]>`. When an item with an existing key changes (or moves),
> the existing child's entry signal is patched instead of unmounting and
> rebuilding it — DOM, listeners, and open menus survive. Render callbacks bind
> to the entry (`.content([entry], ([item]) => …)`) for fields that change;
> tracker's `IssueRow`/`GroupSection` do this now. Note: the render callback is
> still invoked per item per update to discover the child's key; the freshly
> built child is discarded when the key already exists (same cost as before,
> where it was discarded on deep-equality).

`ForEach` keeps a keyed child only when the item is **deep-equal**; any field
change unmounts and rebuilds the whole row (DOM, listeners, menus). For an
issue tracker this means a status change rebuilds the row, closes open menus,
and drops focus. The alternative the type signature already hints at (render
receives a `Signal<[T, number]>`) — patch the existing child's signal instead
of re-rendering — isn't implemented (see PAPERCUTS #3).

## 12. Async/data-fetching story

`Await` is one-shot: no refetch, no invalidation, no mutation helpers, no
stale-while-revalidate. Tracker's comments section refetches by _rebuilding the
whole detail view_ (new `Await` each time). Even a `refetchable(() => promise)`
returning `{ state, refetch }` would go a long way.

## 13. Global event helpers

Keyboard shortcuts ("c" to create) and outside-click detection need raw
`document.addEventListener` with manual cleanup (which is impossible without
lifecycle hooks, see #4). A scoped `onGlobalEvent`/hotkey helper tied to a
component's lifetime would make this safe.

## 14. Class toggling

`className` bindings replace the entire class string, so conditional styling
means rebuilding long Tailwind strings in every getter (see the buttons in
tracker). A `classToggle(name, condition)` or object syntax
(`{ "opacity-40": disabled }`) would compose better.

## 15. Smaller gaps, noted in passing

- **Text nodes**: `content()` owns the whole element; mixing text and child
  elements requires wrapper `Span()`s everywhere.
- **Error boundaries**: an exception in a render callback (e.g. inside
  `ForEach`) propagates to the subscriber that triggered it and can wedge the
  app.
- **Transitions**: no enter/exit animation hooks; menus/dialogs pop.
- **Focus management**: no autofocus, no focus trap for dialogs (tab escapes
  tracker's modal into the page behind it).
- **Forms**: no submit-with-validation story; tracker guards every handler by
  hand.
- **Dev loop**: tsdown watch + `serve` + tailwind + tsx is four processes with
  full-page manual reloads — no HMR, no error overlay. A `create-app` template
  or dev-server package would remove the boilerplate every new demo copies
  (tracker copied it from todo verbatim).
- **Testing**: no way to render a component headlessly and assert on it.
