---
"@implementjs/kit": patch
---

`sse()`, for a `server.ts` endpoint that answers now and keeps writing.

A handler's `Response` already reached the client untouched — kit never
buffered one, and neither did the `hooks.server.ts` around it — so a
`ReadableStream` body has always worked. Nothing said so, nothing said how long
each host would hold one, and the generated client read a raw `Response` as
`data: never` while its runtime called `.text()` on the body, which is exactly
what a stream with no end never comes back from. So the one shape people
actually wanted was the one shape that could not be consumed.

`sse` builds the response, and the client knows how to read it:

```ts
// src/routes/api/inbox/stream/server.ts
import { handler, sse } from "./$types";

export const GET = handler({
	handle: ({ locals }) =>
		sse<Notification>(async function* (signal) {
			for await (const notification of watchInbox(locals.user.id, signal)) {
				yield { event: "notification", data: notification };
			}
		}),
});
```

```ts
const { data, error } = await api.GET("/api/inbox/stream");
if (error !== undefined) return;
for await (const { data: notification } of data) show(notification);
```

Each `yield` is one frame — `data` is the payload, serialized as JSON and typed
end to end, and `event`, `id`, and `retry` are the format's own fields. Like
`json()`, an `sse()` is still a plain `Response` that skips response handling;
unlike one, it says what a caller receives, so `data` is the events rather than
`never`. The call settles when the headers arrive, and `break`ing out of the
loop closes the connection.

A stream ends when its source does, when the client goes away, or when a
`signal` you passed aborts — all three return the iterator, so a generator's
`finally` runs. The source function is handed a signal of its own for the case
a return cannot reach: a generator parked on a promise is only interrupted at a
`yield`, so waiting under that signal is what makes a disconnect wake it. A
keep-alive comment goes out every 15s by default, since an idle connection is
one a proxy eventually closes.

Two other things came with it:

- The docs now say which adapters can hold a long-lived response, and what ends
  one on each — Node and Cloudflare for as long as the source lives, Vercel
  until `maxDuration`, a static build not at all.
- The prerenderer says an event stream cannot be a file, and names the endpoint,
  rather than hanging the build on a response that was never going to finish.
