# API Routes

`handler()` wraps a [`server.ts` endpoint](./SERVER_ROUTES.md) so its edges are typed: params, query, and body validated by any [Standard Schema](https://standardschema.dev), a typed result, a generated client for every caller, and — only if configured — an OpenAPI document.

Everything in [Server Routes](./SERVER_ROUTES.md) still applies. `handler()` returns a plain request handler, so method dispatch, `405`/`Allow`, `export const prerender`, the prerenderer, and every adapter are unaffected.

## Writing one

```ts
// src/routes/api/posts/[id]/server.ts
import { error } from "@implementjs/kit/server";
import * as z from "zod";
import { db } from "@/lib/db";
import { handler } from "./$types";

// No response schema — the client's `data` type is inferred from what `handle` returns.
export const GET = handler({
	query: z.object({ draft: z.stringbool().default(false) }),
	async handle({ params, query }) {
		//          ^? { id: string }    ^? { draft: boolean }
		const post = await db.post(params.id, { draft: query.draft });
		if (post === undefined) error(404, `no post ${params.id}`);
		return post;
	},
});

// A response schema when you want it validated and documented.
export const PATCH = handler({
	params: z.object({ id: z.coerce.number() }), // overrides ServerParams, coerced
	body: Post.pick({ title: true }).partial(),
	response: Post,
	handle: ({ params, body }) => db.update(params.id, body),
});

// plain handlers keep working, unchanged, in the same file
export function HEAD(): Response {
	return new Response(null, { status: 200 });
}
```

**Import `handler` from the route's own `./$types`**, not from the package — that copy is bound to the route's params, so `event.params` is typed without repeating the pattern.

## The definition

| Field              | Required | What `handle` gets                                                                                               |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `params`           | no       | the schema's output; without one, the route's params as strings                                                  |
| `query`            | no       | the schema's output; without one, `url.searchParams` flattened (one value per key, an array where a key repeats) |
| `body`             | no       | the schema's output; without one, `undefined` — an undeclared body is never read                                 |
| `response`         | no       | validates and documents what `handle` returns                                                                    |
| `validateResponse` | no       | run the `response` schema at runtime; defaults to on outside production                                          |
| `handle`           | **yes**  | the handler itself                                                                                               |

`handle` also receives everything a normal `RequestEvent` has: `request`, `url`, `locals`, `route`, `isDataRequest`, `platform`, `setHeaders`, `getClientAddress`, `fetch`, `api`.

Body parsing is by content type: `application/json` → `request.json()`, form content types → `request.formData()` flattened to an object.

## Returning

- Return anything → JSON-serialized.
- Return `undefined` → `204`.
- Return a `Response` → passed through untouched, and skipped by response handling. Use this for markdown, streams, custom headers.

With a `response` schema, `handle`'s return type is checked against it at compile time. Without one, the return type flows straight through to the client — **a typed client costs zero schemas**.

## Errors

A validation failure throws through `error(400, …)`, so it is the same `HttpError` a load's `error(404)` is and `hooks.server.ts` cannot tell them apart. The message names the part and lists every issue:

```
invalid query — area: Invalid type: Expected ("lib" | "kit") but received "nope"
```

Because `error()` returns `never`, it never widens an inferred return type.

## The generated client

Generated for every kit app, with no configuration:

```ts
import { api } from "$implement/client";

const { data, error } = await api.GET("/api/posts/[id]", {
	params: { id: "1" },
	query: { draft: true },
});
if (error !== undefined) return notFound(error.message);
render(data);
```

Route keys are the URL with params still in place — `/api/posts/[id]`, `/docs/[...slug].md` — the same ids the router uses. An unknown key, an unsupported method, missing `params`, or a wrong `body` shape are type errors.

`createClient` builds one pointing elsewhere:

```ts
import { createClient } from "$implement/client";

export const admin = createClient({
	baseUrl: "https://admin.example.com",
	headers: () => ({ authorization: `Bearer ${token()}` }),
});
```

An `ApiError` carries `status`, the parsed `body`, and the `response`. A request that never reached a server is an `ApiError` with status `0`, so `error` is the only branch to handle.

### Error styles

Selected once in `vite.config.ts`:

```ts
kit({ api: { client: { style: "method", errors: "result" } } }); // the defaults
```

| `errors`       | A call returns                                                                    |
| -------------- | --------------------------------------------------------------------------------- |
| `"result"`     | `Promise<{ data, error, response }>`                                              |
| `"throw"`      | `Promise<Data>`, throwing `ApiError`                                              |
| `"neverthrow"` | `ResultAsync<Data, ApiError>` — chain `.map` / `.andThen` / `.match` off the call |

`"neverthrow"` is the only style with a runtime dependency; it ships as its own entry with `neverthrow` as an optional peer.

`style` is `"method"` (`api.GET(path, …)`, the default) or `"path"` (`api["/api/posts/[id]"].GET(…)`).

## `event.fetch` and `event.api`

Every load and handler event carries a `fetch` that:

- resolves relative URLs against `event.url`,
- forwards `cookie` and `authorization` on same-origin requests,
- and **dispatches same-origin requests in-process**, back through the pipeline with no socket.

`event.api` is the generated client bound to it, so a load calling its own API never leaves the process — including during the prerender, where nothing is listening:

```ts
// src/routes/dashboard/page.server.ts
import type { LoadEvent } from "./$types";

export default async function load({ api }: LoadEvent) {
	const { data, error } = await api.GET("/api/posts/[id]", { params: { id: "1" } });
	if (error !== undefined) return { post: null };
	return { post: data };
}
```

A handler that fetches itself is caught by a depth guard rather than left to exhaust the stack.

`event.api` is typed through `App.Api`, which the generated `.implement/` types fill in — the same mechanism as `App.Locals`. Nothing you write declares it.

## OpenAPI (opt-in)

No document is generated unless it is configured. Omit `api.openapi` — the default — and nothing is produced, no file is written, no route is mounted.

```ts
kit({
	api: {
		openapi: {
			info: { title: "Docs API", version: "1.0.0" },
			output: "static/openapi.json", // written on build, served in dev
			path: "/openapi.json", // optional: also mount a live route
		},
	},
});
```

Individual routes opt out with `export const openapi = false;`.

`output` does the work in Node at build time, so the schema library never reaches the deployed server. `path` mounts a live route instead, which does pull the library and its JSON-Schema converter into the server bundle — that is why the two options are separate.

Standard Schema has no JSON-Schema introspection, so conversion is per-vendor and detected from the schema's vendor tag: arktype (`.toJsonSchema()`), zod (`z.toJSONSchema`), valibot (`@valibot/to-json-schema`), each imported lazily in Node. Anything else is documented as unconstrained with a build warning naming the route; `toJsonSchema` in the options overrides the detection. An operation with no schemas is still listed, as a path and a method with an undocumented body.

Only schemas become OpenAPI. Inference serves the client; the document describes whatever schemas you chose to write.
