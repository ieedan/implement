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

## Where the data actually comes from

You never fetch it yourself, but it helps to know the plumbing:

- **First paint.** The server render runs the loads, renders with the data, and embeds it in the HTML. The client picks it up during hydration — no duplicate request.
- **Client-side navigation.** Before a navigation to a load-bearing route commits, kit fetches that route's data from `<path>/__data.json` and only then swaps the page. In dev that endpoint runs your loads on demand; in the built site it's a static file. That fetch usually happens while the pointer is still over the link rather than under the click — see [Preloading](/kit/preloading).
- **On build.** The prerender runs every route's loads once, writing the results into each page's HTML and its `__data.json`. On a static host the data is frozen at build time — rebuild to refresh it.

The [packages page](/packages) of this site is a live example: a `page.server.ts` reads every workspace `package.json` off disk and the page renders the versions from `data`.
