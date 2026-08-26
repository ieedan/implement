---
"@implementjs/adapter-vercel": patch
---

The Vercel function hands the app its invocation context as
`event.platform.context`, so a route can run work after it has answered.

`event.platform` is how kit gets a host's own capabilities to a route, and this
adapter was the one that never filled it in — `serveApp` takes a `platform`
option and the entry it generates simply did not pass one, so `platform` was
`undefined` under Vercel no matter what the runtime offered. The adapter now
reads the context Vercel's Node launcher keeps behind
`Symbol.for("@vercel/request-context")` and passes it through:

```ts
// src/routes/api/issues/server.ts
export async function POST({ platform, request }: RequestEvent): Promise<Response> {
	const issue = await createIssue(await request.json());
	platform?.context.waitUntil?.(deliverWebhooks(issue));
	return Response.json(issue);
}
```

The response goes out immediately and the delivery finishes after it, which
`void deliverWebhooks(issue)` cannot promise: once a serverless invocation has
answered it may be frozen or reclaimed, and the work disappears with it.

Declare the shape in `src/app.d.ts`, beside `App.Locals`:

```ts
declare global {
	namespace App {
		interface Platform {
			context: { waitUntil?: (promise: Promise<unknown>) => void };
		}
	}
}
```

`waitUntil` is optional because the runtime decides: a deployment whose runtime
runs work after the response has it, one without it does not, and a route that
guards the call behaves the same either way. The context is read per request
rather than once at module load — the launcher resolves it out of the async
storage the request runs in, so a load-time read finds nothing.

This is the escape hatch, not an abstraction: nothing in kit changed, and
`event.platform` is still whatever the host hands it. Work that must not be
lost still wants a durable queue — `waitUntil` finishes something, it does not
retry it.
