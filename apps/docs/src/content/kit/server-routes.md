---
title: Server Routes
description: server.ts endpoints serve raw responses — JSON, markdown, anything.
section: Guides
order: 13
---

Not every URL is a page. A `server.ts` in a route directory is an **endpoint**: it exports a handler per HTTP method and returns a standard `Response`.

```ts
// src/routes/api/status/server.ts
import type { RequestEvent } from "./$types";

export function GET(): Response {
	return Response.json({ ok: true });
}

export async function POST({ request }: RequestEvent): Promise<Response> {
	const body = await request.json();
	// ...
	return new Response(null, { status: 204 });
}
```

Handlers receive a `RequestEvent` — the web-standard `request`, the route's `params` as plain strings, the `url`, and the `locals` [`hooks.server.ts`](/kit/hooks) set for this request — typed by the generated `./$types`. A directory serves a page or an endpoint, never both, and requests with a method the module doesn't export get a `405`.

## Extension routes

A directory named `.md` (or any `.<ext>`) holding a `server.ts` serves its **parent's path with the extension appended**. Params still bind from the parent pattern:

```
src/routes
	docs
		.md
			server.ts       → /docs.md
		[...slug]
			.md
				server.ts     → /docs/anything/below.md
			index.ts        → /docs/anything/below
```

```ts
// src/routes/docs/[...slug]/.md/server.ts
import type { RequestEvent } from "./$types";

export function GET({ params }: RequestEvent): Response {
	return new Response(markdownFor(params.slug), {
		headers: { "content-type": "text/markdown; charset=utf-8" },
	});
}
```

This is how a page can have a machine-readable twin at the same address. This site dogfoods it: every docs page serves its plain markdown at its own URL plus `.md` — the **Copy Page** button above is fetching [this page's markdown](/kit/server-routes.md).

It also negotiates: a [server hook](/kit/hooks) redirects any request for a docs page that asks for markdown — `Accept: text/markdown` — to that page's twin, so a reader that wants the source doesn't have to know the convention. Browsers never send that header, so nothing about the page changes for them.

## On build

The prerender renders every `GET` endpoint into a real file in `dist/`, so the built site serves them statically:

- An endpoint without params becomes one file at its path.
- An extension endpoint over params derives its paths from the pages that were prerendered: every prerendered `/docs/foo` gets a `/docs/foo.md` next to it.
- A param endpoint without an extension has no way to enumerate its paths, so it's skipped with a warning — it works in dev, but you'll need a real server to ship it.

That last point generalizes: the built site is static. `GET` endpoints survive as files, but `POST` and friends only exist while a server is running (dev today, a server adapter eventually). Design endpoints you want in production as prerenderable `GET`s.

## In dev

The dev server dispatches matching requests to your endpoint modules before falling through to page routing, with Vite transforms applied — endpoints import your app code, aliases and all, and edits apply on the next request. Endpoint requests go through [`hooks.server.ts`](/kit/hooks) like any other, in dev and on build.
