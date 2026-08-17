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

## 2. A router

Every app needs one. Tracker hand-rolls a hash router in ~25 lines
(`src/lib/router.ts`) — a `Signal<Route>` fed by `hashchange`. Fine for a demo,
but a first-class router with typed routes, a `Link` component (blocked on
`href` support, see #1), and scroll/focus handling belongs in the framework.

## 3. SVG support

`Component.create()` uses `document.createElement`, so SVG elements (which need
`createElementNS`) can't be components. All 25+ icons in tracker are raw SVG
strings injected via `.html()` — no type safety, no per-part reactivity, and
`innerHTML` re-parses on every change.

## 4. Collision-aware floating positioning

Menus position with `absolute top-full` and clip at the viewport edge (tracker's
properties-panel menus had to be hard-coded `align: "right"` after one clipped
off-screen). Collision-aware floating positioning for menus is still open and
would cover 90% of real menus.

## 5. Async/data-fetching story

`Await` still has no invalidation or mutation helpers. Passing a
`Readable<PromiseLike<T>>` now re-follows the source (status changes remount,
a new resolved value patches the readable), but tracker's comments section
still refetches by _rebuilding the whole detail view_. A `refetchable(() =>
promise)` returning `{ state, refetch }` would go a long way.

## 6. Class toggling

`className` bindings replace the entire class string, so conditional styling
means rebuilding long Tailwind strings in every getter (see the buttons in
tracker). A `classToggle(name, condition)` or object syntax
(`{ "opacity-40": disabled }`) would compose better.

## 7. Smaller gaps, noted in passing

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
