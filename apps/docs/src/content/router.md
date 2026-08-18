---
title: Router
description: A typed route-tree router with params as signals, persistent layouts, typed links, and URL-synced search params.
order: 20
---

The router describes the whole app as one nested object. Keys are path segments, `"/"` renders a level, `layout` wraps everything beneath it, and `:param` segments surface as signals.

```ts
import { Router } from "@implementjs/core";

const router = Router(
	{
		"/": () => Home(),
		"/issues": {
			layout: (child) => Shell(child),
			"/": () => Issues(),
			"/:id": { "/": ({ id }) => Issue(id) },
		},
	},
	{ fallback: () => NotFound() },
);

app.render(router);
```

The router is itself a mountable — render it at the root or anywhere inside a layout. It uses history-mode URLs (serve your app with an SPA fallback).

## The route tree

- `"/"` — renders this level. `/issues` above renders `Issues()`.
- `"/segment"` — a nested table for a static segment. Keys may be multi-segment too (`"/settings/profile"`).
- `"/:param"` — a dynamic segment. Every render and layout below it receives the param.
- `layout` — `(child, params) => Child` wraps everything beneath this level; render `child` where the matched content should appear.
- `fallback` (router option) — rendered when nothing matches.

Matching compares segment-by-segment; static segments outrank params at the same position, so `/issues/new` beats `/issues/:id` regardless of declaration order.

## Params are signals

Route params arrive as `Readable<string>`:

```ts
"/:id": {
	"/": ({ id }) => Issue(id), // id: Readable<string>
},
```

Navigating between two URLs of the **same route** (`/issues/1` → `/issues/2`) does not remount the page — the router patches the param signal in place. Bind through it for display, and use `id.onChange(refetch)` (or wrap the page in [`Key(id, ...)`](/docs/key)) when a change should reload data or reset state.

## Persistent layouts

A `layout` mounts once and stays mounted while navigation moves between its descendants — sidebar scroll position, open panels, and local state all survive. Only the diverging part of the route chain remounts.

```ts
"/issues": {
	layout: (child) => Div(Sidebar(), Main(child)), // survives /issues ⇄ /issues/42
	"/": () => Issues(),
	"/:id": { "/": ({ id }) => Issue(id) },
},
```

## Links

`router.Link` renders an `A` that navigates through the router. `to` is typed against the route tree — a typo'd path or a missing param is a compile error:

```ts
router.Link({ to: "/issues" }, "All issues");
router.Link({ to: "/issues/:id", params: { id: issue.id } }, "Open");
router.Link({ to: "/issues/:id", params: { id } }, "Open"); // params can be Readables
```

Behavior:

- Modifier keys (cmd/ctrl/shift/alt), non-left clicks, and a `target` other than `_self` fall through to the browser — open-in-new-tab works.
- `replace: true` replaces the history entry instead of pushing.
- The link sets `aria-current="page"` while its path is current — style it with CSS (`aria-[current=page]:` in Tailwind).
- All other `A` props (class, events, …) pass through.

## Programmatic navigation

```ts
router.navigate("/issues");
router.navigate("/issues/:id", { id: created.id });
router.navigate("/login", { replace: true });

const url = router.href("/issues/:id", { id: 42 }); // "/issues/42"
```

Both are typed against the tree like `Link`. For untyped navigation (external state, redirects by string), the standalone `navigateTo(href, { replace? })` is exported from the package root. Pushing a new entry scrolls to the top; `replace` does not.

## Location

`router.location` is a `Readable<RouterLocation>` — `{ path, search, hash }` — shared by every router and updated on all navigation including back/forward:

```ts
const onSettings = derived([router.location], (l) => l.path.startsWith("/settings"));
```

## Search params

`searchParam(name)` gives a URL-synced query-string value: reads react to navigation, and `set` rewrites the query string in place (replacing the history entry). Bind one to an input and you have a URL-synced search box:

```ts
const query = router.searchParam("q", ""); // fallback: never null

Input({ value: query, placeholder: "Search…" });

const results = derived([issues, query], (list, q) => list.filter((i) => i.name.includes(q)));
```

Setting `null`, `""`, or the fallback removes the parameter from the URL. Without a fallback the value is `string | null`. Also exported standalone as `searchParam` from the package root.

## Current limitations

No redirects, route-level code splitting, navigation guards, scroll restoration on back/forward, relative navigation, or hash/base-path modes yet — see [`MISSING.md`](https://github.com/ieedan/implement/blob/main/MISSING.md) in the repo for the roadmap of sharp edges.
