# Missing

What `@implementjs/core` does not have yet. Sharp edges on things that _do_
exist are in [PAPERCUTS.md](PAPERCUTS.md).

Already in place: arbitrary attributes (`href`, `disabled`, `aria-*`,
`data-*` as typed props), element `this` / `Ref` bindings, lifecycle and
effect ownership (`Implement.Lifecycle` / `Implement.Effect`), clsx-style
`class` values, `Svg`, error boundaries, the router (typed params, typed
`Link`/`href`/`navigate`, persistent layouts, catch-alls, route groups,
URL-synced search params, navigation guards, scroll restoration),
`Implement.Document()` / `Window()`, SSR (`renderToString`), hydration, and
`create-implement-app`.

Focus trapping, keyboard menus, and collision-aware floating live in
`@implementjs/primitives` (dialog, dropdown/context menu, popover, …).

## 1. A data/query layer over `Await`

The primitive now works: swap a promise in a signal and `Await` re-follows,
patching resolved values in place. But everything around it is still
hand-rolled — the refetch function, the "don't refetch on mount" dance
(`onChange` vs `watch({ immediate: false })`), optimistic bumps. And the obvious composition —
`derived([id], (id) => api.fetch(id))` — is wrong in practice because
inactive deriveds recompute per `get()` (PAPERCUTS #1). A `query(() =>
promise)` returning `{ data, error, loading, refetch }` as readables would
delete most of that plumbing.

## 2. Router: the second 80%

The core is there (typed tree, params as readables, layouts that survive
navigation, typed links, catch-alls, search params, fallback, guards, scroll
restoration). What real apps still ask for:

- **Redirects** — `"/"` → `/issues` can only be expressed by duplicating the
  render.
- **Code splitting** — route renders are eager imports; no lazy route form.
  (`@implementjs/kit` code-splits file routes; the core `Router` table does
  not.)
- **`isActive` as a readable** — `Link` sets `aria-current` (enough for CSS),
  but breadcrumbs/parent-section highlighting need prefix matching in code.
- **Relative navigation** — every `Link`/`navigate` is absolute.
- **Hash mode / base path** — history-mode-at-root only.
