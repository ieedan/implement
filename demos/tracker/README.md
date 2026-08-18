# Tracker

A Linear-style issue tracker built on `@implementjs/core` to exercise the
router end to end: typed route params as `Readable`s, typed
`Link`/`href`/`navigate`, a root layout that survives navigation, in-place
param patching, and URL-synced search.

Findings from building it live at the repo root in
[MISSING.md](../../MISSING.md) and [PAPERCUTS.md](../../PAPERCUTS.md).

## Run

```sh
pnpm --filter @demos/tracker dev
```

- App: http://localhost:3003 (Vite dev server; its SPA fallback makes deep
  links like `/issues/:id` reload correctly)
- API: http://localhost:4003 (OpenAPI doc at `/openapi.json`)

The API is Hono + zod-openapi over `node:sqlite`. Delete
`server/tracker.db` to reseed.

## Routes

```
/                 all issues        (layout: sidebar shell)
/views/:view      filtered list     (:view → Readable<string>, ?q= search)
/issues/:id       issue detail      (:id → Readable<string>)
anything else     404 fallback      (rendered outside the layout)
```

The whole table lives in [src/router.ts](src/router.ts); every `Link` and
`navigate` in the app typechecks against it — renaming a path breaks the
stale call sites at compile time.

## Router behaviors this app proves

- **Persistent layout**: the sidebar's DOM nodes survive list ⇄ detail
  navigation (the router swaps only the outlet content).
- **Param patching**: prev/next in the detail header navigates
  `/issues/:id → /issues/:id`; the view is not remounted — the same title
  `<input>` survives while `id` patches through, and a
  `Implement.Lifecycle`-owned `id.onChange` reseeds the draft.
- **Await re-follow**: comments refetch by swapping the promise in a signal;
  resolved values patch in place (stale list stays visible while loading).
- **URL-synced search**: the search box binds `router.searchParam("q", "")` —
  typing rewrites `?q=` (history replace), and a hard reload restores it.
- **Active links**: `Link` sets `aria-current="page"`; the sidebar styles it
  with Tailwind's `aria-[current=page]:` variant. No JS highlighting.
- **History**: back/forward patch params through the location signal; deep
  links hydrate after a full reload.

## Structure

```
server/            tracker API, port 4003
src/router.ts      the route table (layout + 3 routes + fallback)
src/state/         workspace signals + optimistic mutations; dialog form
src/components/ui/ Icon, Avatar, LabelBadge, buttons, Menu, Dialog, TextArea
src/components/    Sidebar (router.Link nav), IssueRow, picker item builders
src/views/         shell (root layout), issue-list, issue-detail,
                   create-issue, not-found
```
