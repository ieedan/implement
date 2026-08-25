---
title: Loading Data
description: Load functions run on the server and feed pages and layouts their data.
section: Guides
order: 12
---

Pages often need data a browser can't produce on its own — files read off disk, a database query, an API call with a secret. Kit's answer is the same as SvelteKit's: put a load function next to the page.

- `page.server.ts` loads data for its directory's page.
- `layout.server.ts` loads data for its directory's layout, and for everything beneath it.

These files run **only on the server** — during dev requests and the build's prerender — and never reach the browser bundle, so they can import `node:fs`, hold secrets, and talk to databases.

## Writing a load

A load default-exports a function that receives the request event — `params`, `url`, the `request` itself, and `locals` — and returns an object (async is fine):

```ts
// src/routes/blog/[slug]/page.server.ts
import { getPost } from "@/lib/posts";
import type { LoadEvent } from "./$types";

export default async function load({ params }: LoadEvent) {
	return { post: await getPost(params.slug) };
}
```

`LoadEvent` comes from the generated `./$types`, like `PageProps` does. Note `params` here are **plain strings**, not signals — a load runs once per request for a concrete URL. The returned object must be JSON-serializable, because kit serializes it into the page.

`locals` is whatever [`hooks.server.ts`](/kit/hooks) put on the event for this request, typed by your `src/app.d.ts` — the usual way a load learns who is asking:

```ts
export default async function load({ locals }: LoadEvent) {
	return { orders: await getOrders(locals.user) };
}
```

## Reading the data

The page (or layout) receives `data`, a readable of everything its route's loads returned:

```ts
// src/routes/blog/[slug]/page.ts
import { derived, Article, H1 } from "@implementjs/core";
import type { PageProps } from "./$types";

export default function Page({ data }: PageProps) {
	return Article(H1(derived([data], ({ post }) => post.title)));
}
```

`data` is a readable for the same reason `params` are: navigating from `/blog/one` to `/blog/two` doesn't remount the page — the router patches params in place and kit reseeds the data, so a `derived` over `data` updates by itself.

The type of `data` is inferred from your load's return type, through `PageData` in `./$types`. No annotations needed on the load itself.

## Layout data flows down

A `layout.server.ts` load contributes to its layout's `data` **and** to every page below it. A page's `data` is the merge of every layout load above it plus its own, later loads winning on key conflicts:

```
src/routes
	layout.server.ts          → { user }
	blog
		[slug]
			page.server.ts        → { post }
			page.ts               → data is { user, post }
```

An `@` [layout reset](/kit/routing) resets data the same way it resets layouts: a page that skips a layout also skips that layout's load.

## Reading the layout's data in a page load

The layouts above a page and the page itself run for the same request, so a page load can wait for what the layouts already worked out instead of working it out again. That's `parent()`:

```ts
// src/routes/app/[slug]/layout.server.ts
import { requireMembership } from "@/lib/auth";
import type { LayoutLoadEvent } from "./$types";

export default async function load({ locals, params }: LayoutLoadEvent) {
	return { workspace: await requireMembership(locals, params.slug) };
}
```

```ts
// src/routes/app/[slug]/issues/page.server.ts
import { listIssues } from "@/lib/issues";
import type { LoadEvent } from "./$types";

export default async function load({ parent }: LoadEvent) {
	const { workspace } = await parent();
	return { issues: await listIssues(workspace.id) };
}
```

`parent()` resolves to everything the loads **above** this one returned, merged root first — the same merge `data` is, minus this load's own contribution. It's typed from those loads' return types, so `workspace` here is whatever `requireMembership` hands back.

That matters most for decisions rather than data. A membership check that lives in the layout and is read by the pages beneath it is made once per request; one repeated in every page load is four queries and, worse, four copies of the same authorization rule.

`./$types` exports two flavours, because a directory's own layout is a parent of its page but not of itself:

- `LoadEvent` — for `page.server.ts`. `parent()` is every layout above the page, this directory's own included.
- `LayoutLoadEvent` — for `layout.server.ts`. `parent()` is the layouts above _it_.

### Loads run concurrently

Kit starts every load in a route's chain at once. A page load that never calls `parent()` doesn't wait for the layout above it, so a chain of four independent loads costs one round of work rather than four in a row.

`parent()` is how you opt back into sequencing, and it only ever waits on the loads above the one calling it — which is why awaiting it can't deadlock. If a page load needs the layout's data, it awaits `parent()` and pays for that wait; its sibling that doesn't, doesn't.

One consequence worth knowing: a page load can't rely on its layout's load having mutated `locals` first, because the two may well be in flight together. Pass the value through `parent()` instead.

## Calling your own API from a load

A load's event carries a `fetch` of its own, and an `api` — the [generated client](/kit/api-routes) bound to it. A same-origin request through either is dispatched **in-process**, back through the request pipeline with no socket in between, so a load reading its own app's endpoint costs a function call rather than a round trip out of the process and back:

```ts
// src/routes/dashboard/page.server.ts
import type { LoadEvent } from "./$types";

export default async function load({ api }: LoadEvent) {
	const { data, error } = await api.GET("/api/posts/[id]", { params: { id: "1" } });
	if (error !== undefined) return { post: null };
	return { post: data };
}
```

`event.fetch` also resolves relative URLs against `event.url` and forwards the request's `cookie` and `authorization` headers on same-origin calls, so an endpoint behind a session sees the same session the page does.

## Re-running a load after a mutation

A load runs when a page is rendered or navigated to. When the user then _changes_ something, the data that load returned is stale — and that's what `invalidate()` is for:

```ts
import { invalidate, invalidateAll } from "$implement/navigation";

await api.PATCH("/api/v1/issues/[id]", { params: { id }, body: { done: true } });
await invalidate();
```

`invalidate()` re-runs the loads feeding the page you're on and reseeds `data` with what they return. It goes through the same `__data.json` endpoint a client navigation uses, so it is the same loads, the same merge, and the same typed `data` — nothing is patched by hand.

The new data lands in the store the page is already reading, so a component holding `data` — or anything `derived` from it — updates where it stands. Nothing remounts.

`invalidate()` resolves once the fresh data is seeded, so awaiting it means the page is showing it.

### Naming a route

With no argument, `invalidate()` re-runs everything feeding the page. Pass a route and the loads only re-run when that route is part of what's on screen — the page's own route, or a layout above it:

```ts
// the unread count lives in the app shell's layout load, and this page is
// inside that shell — so the shell's load re-runs with everything else
await invalidate("/app/:slug");

// a route this page is not inside: nothing to do
await invalidate("/app/:slug/settings");
```

The argument is a route pattern (`/app/:slug/inbox`) or a concrete path (`/app/acme/inbox`) — a concrete path is just a pattern that binds nothing.

`invalidateAll()` is `invalidate()` with nothing to narrow it. Kit keys load data by the server file that produced it and one route's chain is live at a time, so "all of them" and "this page's" are the same set; the two names are there so the call site can say which one it meant.

Two invalidations in flight at once are a mutation answered twice, and the older answer is the stale one however the network ordered them — kit drops it rather than seeding it over the newer one. So is an answer that arrives after the user has navigated away.

## Where the data actually comes from

You never fetch it yourself, but it helps to know the plumbing:

- **First paint.** The server render runs the loads, renders with the data, and embeds it in the HTML. The client picks it up during hydration — no duplicate request.
- **Client-side navigation.** Before a navigation to a load-bearing route commits, kit fetches that route's data from `<path>/__data.json` and only then swaps the page. In dev that endpoint runs your loads on demand; in the built site it's a static file.
- **`invalidate()`.** The same `__data.json` request, made on demand instead of on the way into a route, with the result seeded into the store the mounted page is reading.
- **On build.** The prerender runs every route's loads once, writing the results into each page's HTML and its `__data.json`. On a static host the data is frozen at build time — rebuild to refresh it.

The [packages page](/packages) of this site is a live example: a `page.server.ts` reads every workspace `package.json` off disk and the page renders the versions from `data`.
