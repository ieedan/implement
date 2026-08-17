# Missing

What `@packages/implement` does not have yet, compiled while building the router
and `demos/tracker` (a Linear-style issue tracker: routed list/detail
views, dropdown menus, a modal dialog, inline editing, comments). Roughly
ordered by how much each one hurt. Sharp edges on things that _do_ exist are
in [PAPERCUTS.md](PAPERCUTS.md).

Already in place: arbitrary attributes (`href`, `disabled`, `aria-*`,
`data-*` all work as typed props — links and accessible buttons are real),
the router (typed params, typed `Link`/`href`/`navigate`, persistent
layouts, URL-synced search params), element `this` bindings
(`Div({ this: el })`), and `Implement.Document()` / `Window()`
(mount-scoped global listeners).

## 1. Element refs **(fixed)**

Elements accept `this: Ref<El>` (or `Ref<HTMLElement>`). Mount writes the
node after appending to the parent; unmount writes `null`.
`Menu` now closes on outside click via `contains()`, and the create-dialog
title focuses through a `Ref` instead of `querySelector`.

## 2. Lifecycle / effect ownership **(fixed)**

`Implement.Lifecycle({ onMount, onUnmount }, ...children)` hooks
mount/unmount at its tree position — standalone (renders nothing) or
wrapping children it owns. `onMount` runs once the tree is connected
(focus/measure work) and may return a cleanup, which is how subscriptions
get scoped to the mounted lifetime: the detail view's `id.onChange`
reseeds return their unsubscribe. `onUnmount` runs while children are
still in the DOM. The demo's hand-rolled `Effect`/`AfterMount` mountables
(`src/lib/dom.ts`) are deleted.

## 3. A data/query layer over `Await`

The primitive now works: swap a promise in a signal and `Await` re-follows,
patching resolved values in place (tracker's comments do exactly this).
But everything around it is still hand-rolled — the refetch function, the
"don't refetch on mount" dance (`onChange` vs `watch`), optimistic bumps.
And the obvious composition — `derived([id], (id) => api.fetch(id))` — is
wrong in practice because inactive deriveds recompute per `get()`
(PAPERCUTS #6). A `query(() => promise)` returning
`{ data, error, loading, refetch }` as readables would delete most of
tracker's comments plumbing.

## 4. Router: the second 80%

The core is there (typed tree, params as readables, layouts that survive
navigation, typed links, search params, fallback). What real apps ask for
next, none of which exists:

- **Redirects** — `"/"` → `/issues` can only be expressed by duplicating the
  render.
- **Not-found within layouts** — the fallback replaces the whole tree
  (PAPERCUTS #11); no catch-all segment.
- **Navigation guards/blocking** — the detail view's dirty description is
  silently lost on navigation; there is no "are you sure" hook.
- **Code splitting** — route renders are eager imports; no lazy route form.
- **Scroll restoration** — pushes scroll to top, but back/forward doesn't
  restore the previous scroll position.
- **`isActive` as a readable** — `Link` sets `aria-current` (enough for CSS),
  but breadcrumbs/parent-section highlighting need prefix matching in code.
- **Relative navigation** — every `Link`/`navigate` is absolute.
- **Hash mode / base path** — history-mode-at-root only; deep links require
  an SPA-fallback static server (`serve -s`) and absolute asset paths in
  `index.html`, which cost a debugging round.

## 5. SVG support **(fixed)**

`Svg(source, props)` builds an `<svg>` from trusted markup: each unique
string parses once (cached template, cloned per mount) and typed props go on
the root as attributes — `class`/`style`/events/`this` plus `viewBox`,
`width`, `fill`, `stroke-*`, all bindable. Props override attributes baked
into the string. `Icon` is now `Svg(icons[name], { class })` with no wrapper
span, and `ReactiveIcon` swaps glyphs by driving a readable source.

## 6. Focus management

The dialog has no focus trap (Tab escapes into the page behind it) and
nothing restores focus on close. Menus aren't keyboard-navigable (no arrow
keys, no typeahead, no focus on open).

## 7. Collision-aware floating positioning

Menus are `absolute top-full` with a hardcoded `align: "right"` where they'd
clip. Still the biggest visual-quality gap for real menus.

## 8. Class toggling

`class` bindings replace the whole string, so conditional styling is
`derived` + `cx` template rebuilding everywhere. An object/array form
(`{ "opacity-40": disabled }`) keeps coming up.

## 9. Error boundaries **(fixed)**

`Implement.Boundary(...children).Catch((error, reset) => ...)` isolates
subtree failures: errors thrown while the subtree mounts, during any
reactive helper's re-sync (`If`/`ForEach`/`Switch`/`Key`/`Await`/`Portal`),
or in `Lifecycle.onMount` route to the nearest boundary, which swaps in the
`Catch` branch (deferred a microtask, before paint). `reset` remounts the
children from scratch; an error in the `Catch` branch itself escalates to
the next boundary up instead of looping. Still uncaught by design: event
handler errors (try/catch them yourself) and promise rejections
(`Await.Catch`'s job) — and a derived getter that throws outside a guarded
sync pass (e.g. from a plain `get()`) still propagates to its caller.

## 10. Testing story

No headless renderer, so none of tracker is tested except by clicking.
The router's matching/param logic is pure and would unit-test trivially if
mounting didn't require a real DOM.

## 11. Dev loop

Four processes (tsdown, tailwind, static server, API) and full manual
reloads. Every demo copies the same scaffold with only ports changed,
including generalizing the `serve` invocation to `-s` for SPA fallback. A
`create-app` template or dev-server package would end the copying.
