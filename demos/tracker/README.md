# Tracker

A Linear-style issue tracker built to stress-test `@packages/ui` end to end:
signals, keyed lists, dropdown menus, a modal dialog, inline editing, routing,
and a real database behind a typed API.

Findings from building it live at the repo root in
[MISSING.md](../../MISSING.md) and [PAPERCUTS.md](../../PAPERCUTS.md).

## Run

```sh
pnpm --filter @demos/tracker dev
```

- App: http://localhost:3001
- API: http://localhost:4001 (OpenAPI doc at `/openapi.json`)

The API stores data in SQLite via `node:sqlite` (zero native deps) at
`server/tracker.db`, seeded on first run. Delete the file to reseed.

## Features

- Issues grouped by status, sorted by priority, with search and sidebar views
  (All / My Issues / Active / Backlog) with live counts
- Inline status/priority pickers on every row; full properties panel
  (status, priority, assignee, labels) on the detail view
- Editable title (save on blur/Enter) and description (dirty-state save/discard)
- Comments: list, post (Cmd+Enter), delete
- Create-issue dialog — `c` shortcut or the sidebar button, with reactive
  status/priority/assignee/label pickers
- Optimistic updates with rollback on API failure
- Hash routing (`#/`, `#/issue/:id`) with working browser back/forward

## Structure & patterns

```
server/            Hono + zod-openapi API over node:sqlite (db.ts = schema/seed)
src/api/           generated HeyAPI client (pnpm generate)
src/state/store.ts workspace data: signals + optimistic mutation actions
src/state/ui.ts    view state: active view, search, create-form signals
src/lib/           router, cx, time formatting, dom helpers
src/components/ui/ generic primitives: Icon, buttons, Menu, Dialog, Avatar,
                   LabelBadge, TextArea
src/components/    app pieces: Sidebar, IssueRow, picker item builders
src/views/         IssueListView, IssueDetail, CreateIssueDialog, App shell
```

Conventions used throughout:

- Components are `PascalCase` functions returning a `Mountable`; one component
  per concern, styled inline with Tailwind class strings (`cx()` to compose).
- Reactive derivations: `Derived` for shared state, `[signals] + getter`
  bindings for per-element text/class.
- List rows read plain values and rely on keyed `ForEach` rebuilds; long-lived
  forms (the create dialog) bind signals instead.
- Shared menu items for status/priority/assignee/labels come from
  `components/pickers.ts` and accept either a plain value (row context) or a
  `Signal` (form context).
- The routed detail view is a single-item `ForEach` keyed by issue id — the
  framework's stand-in for a dynamic subtree.
