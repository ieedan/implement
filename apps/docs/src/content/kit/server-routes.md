---
title: Server Routes
description: server.ts endpoints serve raw responses — JSON, markdown, anything.
section: Guides
order: 14
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

> [!NOTE]
> That is the whole contract, and everything below applies to it unchanged. When you want the edges typed as well — a validated body, a typed result, and a generated client for every caller — wrap the handler in [`handler()`](/kit/api-routes). It returns a plain handler, so nothing on this page changes.

## Endpoints are server-only

A `server.ts` never enters the client bundle — it is as server-only as anything named `*.server.ts`, and kit enforces it the same way. Importing one from client code is an error in dev and on build:

```
src/routes/api/issues/server.ts is a route endpoint and cannot be imported by client code.

  src/routes/api/issues/server.ts
  imported by src/lib/features/issues/create-issue-dialog.ts as "@/routes/api/issues/server"
    ← src/routes/(dashboard)/layout.ts:3 imports { CreateIssueDialog }
    ← $implement/router
    ← .implement/entry-client.ts
```

The chain names the import that pulled it in, because the file that broke the rule is rarely the file you were editing.

The one that catches people is a validation schema: the endpoint declares it, and a form on the client wants the same one. Put it in a module both sides import, and let the endpoint import it too.

```ts
// src/lib/issues/schema.ts — shared, no server imports
export const NewIssueSchema = z.object({ title: z.string().min(1) });
```

```ts
// src/routes/api/issues/server.ts
import { db } from "@/lib/db.server";
import { NewIssueSchema } from "@/lib/issues/schema";

export const POST = handler({ body: NewIssueSchema, handle: ({ body }) => db.issues.create(body) });
```

Types are exempt, as always — `import type { … }` is erased before the module graph sees it, so a client file may read an endpoint's types freely. That is how [the generated client](/kit/api-routes) is typed.

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
			page.ts         → /docs/anything/below
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

## Streaming

A handler's `Response` reaches the client untouched, so a body that is a `ReadableStream` stays one: kit never buffers it, and neither does the `hooks.server.ts` around it. An endpoint can answer a request now and keep writing to it for as long as it likes.

The long-lived case with a format of its own is **server-sent events**, and `sse` builds one. It is one-way — when you need both directions of one connection, reach for a [WebSocket](/kit/websockets) instead:

```ts
// src/routes/api/inbox/stream/server.ts
import { handler, sse } from "./$types";
import { watchInbox } from "@/lib/inbox.server";

export const GET = handler({
	handle: ({ locals }) =>
		sse<Notification>(async function* (signal) {
			for await (const notification of watchInbox(locals.user.id, signal)) {
				yield { event: "notification", data: notification };
			}
		}),
});
```

Each `yield` is one frame. `data` is the payload — serialized as JSON, and typed — and `event`, `id`, and `retry` are the format's own fields, all optional.

The generated client reads it back as the events themselves rather than as text, so a stream is one of the few `Response`s that still says what a caller receives:

```ts
const { data, error } = await api.GET("/api/inbox/stream");
if (error !== undefined) return;
for await (const { data: notification } of data) show(notification);
```

The call settles as soon as the response headers arrive — the frames are still being written — and `break`ing out of the loop, or aborting the call's `signal`, closes the connection. A browser's own [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) reads the same URL if you would rather have its automatic reconnection.

### Ending one

A stream ends when its source does, when the client goes away, or when a `signal` you passed aborts. All three return the iterator, so a generator's `finally` runs and whatever the stream was holding gets let go:

```ts
sse<Tick>(async function* (signal) {
	const subscription = await subscribe();
	try {
		for await (const tick of subscription.ticks(signal)) yield { data: tick };
	} finally {
		await subscription.close();
	}
});
```

That `signal` argument is the one thing worth taking care over. Returning a generator interrupts it at a `yield` and nowhere else, so a source parked on a promise that never settles is never reached — wait under the signal instead, and the disconnect is what wakes you.

| Option      | Default |                                                                     |
| ----------- | ------- | ------------------------------------------------------------------- |
| `keepAlive` | `15000` | milliseconds between comment frames, or `false` for none            |
| `signal`    | —       | ends the stream when it aborts — a shutdown, a deadline of your own |
| `status`    | `200`   | and any other `ResponseInit` field, `headers` included              |

The keep-alive is there because an idle connection is one a proxy eventually closes. Kit sends a comment frame on that interval, which every client discards and every proxy counts as traffic.

### Where a stream can live

An open connection is a resource on whatever is holding it, and hosts differ on how long they will:

| Host                                             | A long-lived response                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| dev, and [`adapter-node`](/kit/adapters#node)    | as long as you like — a proxy in front may have an idle timeout of its own  |
| [`adapter-cloudflare`](/kit/adapters#cloudflare) | yes; waiting costs no CPU time, and a worker is billed for what it uses     |
| [`adapter-vercel`](/kit/adapters#vercel)         | yes, until `maxDuration` — the function is stopped at the limit, mid-stream |
| [`adapter-static`](/kit/adapters#static)         | no: nothing is running to hold one                                          |

A [socket route](/kit/websockets#where-a-socket-can-live) reads slightly differently. Vercel will hold a streaming response open, but there is no upgrade path into a serverless function — so that adapter and the static one both fail the build on a socket route rather than deploying one that answers with a 404.

A streaming endpoint must also never be prerendered — a file is a body with an end, and a live stream has none. With a server that is already the default; a static build prerenders `GET` endpoints, so say so:

```ts
export const prerender = false;
```

The build says the same thing if you forget, rather than hanging on a response that was never going to finish.

## On build

The prerender renders every `GET` endpoint into a real file in `dist/`, so the built site serves them statically:

- An endpoint without params becomes one file at its path.
- An extension endpoint over params derives its paths from the pages that were prerendered: every prerendered `/docs/foo` gets a `/docs/foo.md` next to it.
- A param endpoint without an extension has no way to enumerate its paths, so it's skipped with a warning — it works in dev, but you'll need a real server to ship it.

That last point generalizes to how the app is deployed. With no adapter the built site is static: `GET` endpoints survive as files, and `POST` and friends only exist while the dev server is running. Add an [adapter](/kit/adapters) and every method ships — the endpoint runs per request, the way it does in dev:

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-node";

kit({ adapter: adapter() });
```

With a server behind them, `GET` endpoints stop being prerendered by default too — the server can answer them with fresher data than the build could. `export const prerender = true` from the `server.ts` puts one back in the build as a file.

## In dev

The dev server dispatches matching requests to your endpoint modules before falling through to page routing, with Vite transforms applied — endpoints import your app code, aliases and all, and edits apply on the next request. Endpoint requests go through [`hooks.server.ts`](/kit/hooks) like any other, in dev and on build.
