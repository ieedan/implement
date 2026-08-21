---
title: Load functions
description: A page.server.ts runs on the server and feeds the page its data.
section: Server data
focus: src/routes/blog/[slug]/page.server.ts
---

Pages often need data a browser can't produce — a database query, files read off disk, an API call with a secret. In kit you put that code in a **load function** right next to the page:

- `page.server.ts` loads data for its directory's page.
- `layout.server.ts` loads data for its layout and everything beneath it.

These files run only on the server and never reach the browser bundle. A load default-exports a function that receives `params` (plain strings here, not signals — a load runs once per request) and returns an object:

```ts
export default function load({ params }) {
	return { post: findPost(params.slug) };
}
```

The page receives everything its route's loads returned as `data` — a **readable**, like `params`, because navigating between `/blog/one` and `/blog/two` doesn't remount the page; kit reseeds the data and a `derived` over it updates in place:

```ts
export default function Page({ data }) {
	return H1(derived([data], ({ post }) => post.title));
}
```

> [!NOTE]
> In a real kit app loads run in Node — during dev requests and the build's prerender — and client-side navigations fetch their results from `__data.json`. This playground has no server, so it runs your load directly in the preview, but the contract is identical.

## Your task

The blog page is finished — it renders whatever `data.post` holds. The load isn't: it ignores the slug and returns `{ post: null }`, so every post shows "Post not found".

1. In `src/routes/blog/[slug]/page.server.ts`, look the post up in `POSTS` by `params.slug` and return it as `{ post }`. Return `null` when the slug isn't in `POSTS`, so unknown posts keep the not-found rendering.

You're done when the two posts on the home page each show their own title and body, and a made-up path like `/blog/nope` still shows **Post not found**.
