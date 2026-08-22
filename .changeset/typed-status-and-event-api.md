---
"@implementjs/kit": patch
---

Fix two holes in the generated client's types: `event.api` had no methods at all, and returning JSON with a custom status typed `data` as `never`.

**`event.api` was an empty `App.Api`.** The generated declaration wrote `interface Api extends import("@implementjs/kit/client").TypedClient<…> {}`, and an interface may only extend a _name_ — extending an inline `import(…)` type is `TS2499`. Apps compile their generated types with `skipLibCheck`, so nobody ever saw the error: `App.Api` merged as empty, `keyof` was `never`, and `api.GET(…)` in a load was `Property 'GET' does not exist`. The client is now named before it is extended, so `event.api` in loads, handlers, and hooks is the same client `$implement/client` exports — same style, same routes, same `data`.

A server assembled without `createApiClient` used to get `{}` for `event.api`, which only typechecked while `App.Api` was empty. It now gets a stand-in whose every method throws a message naming the missing option, instead of failing as `undefined is not a function`.

**`json()` sets a status without losing the body's type.** Returning a `Response` opts out of response handling, so `data` was `Exclude<Awaited<R>, Response>` — and `Response.json(issue, { status: 201 })` is a `Response`, which made `data` `never`. `json` is `Response.json` with the body type kept:

```ts
import { handler, json } from "./$types";

export const POST = handler({
	body: NewIssue,
	handle: async ({ body }) => json(await createIssue(body), { status: 201 }),
});

const { data } = await api.POST("/api/issues", { body }); // the issue, not `never`
```

It comes from `@implementjs/kit/server` and a route's `./$types` re-exports it beside `handler`. A plain `Response` is still the escape hatch for a body that is not JSON, and still reads as `never` — there is nothing to say about it. With a `response` schema the schema types `data`, and returning any `Response` still skips that validation.
