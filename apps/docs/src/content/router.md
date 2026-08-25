---
title: Router
description: A typed route-tree router with params as signals, persistent layouts, typed links, and URL-synced search params.
section: Building applications
order: 20
---

The router ships as its own package, built on the same public API your own nodes get — see [custom nodes](/docs/custom-nodes) for what that surface is.

```sh
npm install @implementjs/router
```

This page is about writing the table yourself, which is what a client-rendered app on plain Vite does. [kit](/kit) writes it from your `src/routes` directory instead: it brings the router along and resolves it for you, so a kit app neither installs this package nor calls `Router` — it gets the same `Link`, `href`, `navigate` and `searchParam` from `$implement/router`, and everything below about params, layouts and matchers describes what it does at runtime.

It describes your whole app as one nested object. Keys are path segments, `"/"` renders a level, `layout` wraps everything beneath it, and `:param` segments surface as signals.

```ts
import { Router } from "@implementjs/router";

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

The router is itself a mountable, so you can render it at the root or anywhere inside a layout. It uses history-mode URLs (serve your app with an SPA fallback).

## The route tree

- `"/"` renders this level. `/issues` above renders `Issues()`.
- `"/segment"` is a nested table for a static segment. Keys may be multi-segment too (`"/settings/profile"`).
- `"/:param"` is a dynamic segment. Every render and layout below it receives the param. `"/:param=name"` gates it behind a [matcher](#param-matchers).
- `layout` is `(child, params) => Child` and wraps everything beneath this level. Render `child` where the matched content should appear.
- `fallback` (a router option) is rendered when nothing matches, or when a route render throws. It receives a `RouterError` — `{ code, message }`, where `code` is `404` for unmatched paths, `500` for a thrown render error, or the `code` of a thrown `{ code, message }` object.

Matching compares segment by segment, and static segments outrank params at the same position, so `/issues/new` beats `/issues/:id` regardless of declaration order.

## Params are signals

Route params arrive as `Readable<string>`:

```ts
"/:id": {
	"/": ({ id }) => Issue(id), // id: Readable<string>
},
```

Navigating between two URLs of the **same route** (`/issues/1` → `/issues/2`) does not remount the page. The router patches the param signal in place. Bind through it for display, and use `id.onChange(refetch)` (or wrap the page in [`Key(id, ...)`](/docs/key)) when a change should reload data or reset state.

## Param matchers

A `:param` takes any segment. `":param=<name>"` runs a **matcher** over it first: a segment the matcher turns down is not a match, so routing carries on to the next route, and a matcher that _parses_ decides what the param carries.

```ts
import { mismatch, Router, type RouteMatcher } from "@implementjs/router";

const integer: RouteMatcher<number> = {
	match: (value) => (/^\d+$/.test(value) ? Number(value) : mismatch),
};

const router = Router(
	{
		"/issues": {
			"/:id=integer": ({ id }) => Issue(id), // id: Readable<number>
			"/:slug": ({ slug }) => IssueBySlug(slug), // /issues/backlog lands here
		},
	},
	{ matchers: { integer } },
);
```

A matched param outranks a plain one at the same position, the way a static segment outranks both. Naming a matcher that isn't in `matchers` throws when the router is built, rather than becoming a route that never matches.

For `id` to be a `Readable<number>` rather than a `Readable<string>`, tell the router what the matcher produces:

```ts
declare module "@implementjs/router" {
	interface ParamTypes {
		integer: number;
	}
}
```

[`@implementjs/kit`](/kit/routing#param-matchers) fills that in for you: drop a `src/params/integer.ts` in an app and every `[id=integer]` route gets the typed param, in `./$types` and in the router alike.

## Persistent layouts

A `layout` mounts once and stays mounted while navigation moves between its descendants. Sidebar scroll position, open panels, and local state all survive. Only the diverging part of the route chain remounts.

```ts
"/issues": {
	layout: (child) => Div(Sidebar(), Main(child)), // survives /issues ⇄ /issues/42
	"/": () => Issues(),
	"/:id": { "/": ({ id }) => Issue(id) },
},
```

## Links

`router.Link` renders an `A` that navigates through the router. `to` is typed against the route tree, so a typo'd path or a missing param is a compile error:

```ts
router.Link({ to: "/issues" }, "All issues");
router.Link({ to: "/issues/:id", params: { id: issue.id } }, "Open");
router.Link({ to: "/issues/:id", params: { id } }, "Open"); // params can be Readables
```

A few behaviors worth knowing:

- Modifier keys (cmd/ctrl/shift/alt), non-left clicks, and a `target` other than `_self` fall through to the browser, so open-in-new-tab works.
- `replace: true` replaces the history entry instead of pushing.
- `noScroll: true` follows the link without jumping to the top. See [scroll restoration](#scroll-restoration).
- The link sets `aria-current="page"` while its path is current. Style it with CSS (`aria-[current=page]:` in Tailwind).
- All other `A` props (class, events, ...) pass through.

## Programmatic navigation

`navigate` takes params under a `params` key, the way `Link` does, next to the navigation options. A nav item that becomes a menu item's `onSelect` keeps the object it already had:

```ts
router.navigate("/issues");
router.navigate("/issues/:id", { params: { id: created.id } });
router.navigate("/issues/:id", { params: { id }, replace: true }); // params can be Readables
router.navigate("/login", { replace: true });
router.navigate("/issues", { noScroll: true });

const url = router.href("/issues/:id", { params: { id: 42 } }); // "/issues/42"
```

A `Readable` param is read when the call happens. A `Link` goes on tracking one and rewrites its `href`; `navigate` and `href` are a moment, not a subscription, so they take the value it has then — which is why the same params work for both without a `.get()` in between.

Both also still take params as a bare second argument — `router.navigate("/issues/:id", { id }, { replace: true })` and `router.href("/issues/:id", { id })` — the shape they had before the `params` key. It keeps working; new code should use `params`.

Both are typed against the tree like `Link`. `href` only builds the string — it never navigates, so it has nothing to scroll. For untyped navigation (external state, redirects by string) there is `navigateTo(href, { replace?, noScroll? })`, which lives in `@implementjs/core` — navigation and the current location are core's, not the router's.

## Scroll restoration

The router records a scroll position per history entry, so back and forward land where you left off — including on a reload, which the positions outlive by riding in `sessionStorage`. That means the router takes restoration over from the browser (`history.scrollRestoration = "manual"`), which it can only do correctly: when a `popstate` fires the page being left is still in the DOM, so a browser restoring on its own measures against the wrong document.

A new navigation starts at the top instead, and `noScroll` skips that — Svelte's `goto(url, { noScroll })`:

```ts
router.Link({ to: "/issues?state=open", noScroll: true }, "Open issues");
router.navigate("/issues", { noScroll: true });
navigateTo("/issues?state=open", { noScroll: true });
```

A `replace` rewrites the URL of the page you are already reading, so it never scrolls with or without the flag — which is why `searchParam.set` leaves the page where it is. Back and forward ignore `noScroll` and restore the recorded position.

A position is recorded per entry, not per URL: the same page visited twice in one session is two entries with two positions. Entries the router never created — pushed by something else on the page — have no recorded position and land at the top.

## Location

`router.location` is a `Readable<RouterLocation>` of `{ path, search, hash }`. It's shared by every router and updated on all navigation including back/forward:

```ts
const onSettings = derived([router.location], (l) => l.path.startsWith("/settings"));
```

## Search params

`searchParam(name)` gives you a URL-synced query-string value. Reads react to navigation, and `set` rewrites the query string in place (replacing the history entry). Bind one to an input and you have a URL-synced search box:

```ts
const query = router.searchParam("q", ""); // fallback: never null

Input({ value: query, placeholder: "Search…" });

const results = derived([issues, query], (list, q) => list.filter((i) => i.name.includes(q)));
```

Setting `null`, `""`, or the fallback removes the parameter from the URL. Without a fallback the value is `string | null`. It's also exported standalone as `searchParam` from `@implementjs/core`, along with `location`, `navigateTo`, and the navigation guards.

## Current limitations

No redirects, route-level code splitting, relative navigation, or hash/base-path modes yet. A navigation to a `#hash` restores or resets scroll like any other — it does not scroll the fragment's element into view for you. See [`MISSING.md`](https://github.com/ieedan/implement/blob/main/MISSING.md) in the repo for the roadmap of sharp edges.

The router itself is built on parts the package exports — a swappable region, the current location, an effect. [Custom nodes](/docs/custom-nodes) shows the same pieces from the other side, and builds a small router out of them.
