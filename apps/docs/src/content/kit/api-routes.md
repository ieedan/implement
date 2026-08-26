---
title: API Routes
description: Validated handlers, a generated typed client, and an optional OpenAPI document — off one definition.
section: Guides
order: 15
---

A [`server.ts` endpoint](/kit/server-routes) is a function that takes a `Request` and returns a `Response`. That is the whole contract, and it is untyped at both edges: nothing describes the body coming in, nothing describes what goes out, and nothing connects the endpoint to the code that calls it.

`handler()` closes that gap. Wrap a handler in it, and one definition gives you validated inputs, a typed result, a generated client for every caller, and — if you ask for one — an OpenAPI document.

```ts
// src/routes/api/posts/[id]/server.ts
import { error } from "@implementjs/kit/server";
import * as v from "valibot";
import { db } from "@/lib/db";
import { handler } from "./$types";

export const GET = handler({
	query: v.object({
		draft: v.optional(
			v.pipe(
				v.string(),
				v.transform((value) => value === "true"),
			),
			"false",
		),
	}),
	async handle({ params, query }) {
		//          ^? { id: string }    ^? { draft: boolean }
		const post = await db.post(params.id, { draft: query.draft });
		if (post === undefined) error(404, `no post ${params.id}`);
		return post;
	},
});
```

Note what is not there: no `await request.json()`, no cast, no manual `Response.json`. And no response schema — the client's `data` type for this route is whatever `handle` returns.

`handler` comes from the route's own `./$types`, so `params` is typed from the route's pattern without you repeating it.

## What gets validated

Every field is optional. Declare one and kit validates that part of the request; leave it out and it comes through as-is.

|          | What `handle` receives                      | Without a schema                                                     |
| -------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `params` | the schema's output over the route's params | the route's params, as strings                                       |
| `query`  | the schema's output                         | `url.searchParams`, one value per key (an array where a key repeats) |
| `body`   | the schema's output                         | `undefined` — an undeclared body is never read                       |

Schemas are anything implementing [Standard Schema](https://standardschema.dev). These docs use [valibot](https://valibot.dev), but arktype, zod or anything else implementing the spec works the same. Kit does not bundle one; you bring the library you already use, exactly as with [`defineEnv`](/kit/environment-variables).

```ts
export const PATCH = handler({
	params: v.object({ id: v.pipe(v.string(), v.transform(Number), v.number()) }), // narrows the route's string
	body: v.partial(v.pick(Post, ["title"])),
	response: Post,
	handle: ({ params, body }) => db.update(params.id, body),
});
```

A `params` schema **narrows the params it names**, and only those. Kit merges the schema's output over what the route bound — at runtime and in the type — so a param the schema says nothing about is still there, still typed from the route:

```ts
// src/routes/api/workspaces/[slug]/issues/[number]/server.ts
export const GET = handler({
	params: v.object({ number: v.pipe(v.string(), v.transform(Number), v.number()) }),
	handle: ({ params }) => db.issue(params.slug, params.number),
	//                                     ^? string        ^? number
});
```

A `[number=integer]` [matcher](/kit/routing) does the same thing a directory at a time, for every route that names it — and without a schema per handler.

A body is parsed by content type: `application/json` is parsed as JSON, form content types are parsed as `FormData` and flattened to an object (one value per field, an array where a field repeats).

A validation failure throws through [`error(400, …)`](/kit/hooks), so it is the same `HttpError` a load's `error(404)` is — `handleError` and `hooks.server.ts` cannot tell them apart. The message names the part and lists every issue:

```
invalid query — area: Invalid type: Expected ("lib" | "kit" | …) but received "nope"
```

## What comes back

Return anything and kit serializes it as JSON. Return `undefined` and the response is a `204`. Return a `Response` and it goes through untouched — which is how you set a content type, [stream](/kit/server-routes#streaming), or answer with something that is not JSON:

```ts
export const GET = handler({
	params: v.object({ slug: v.string() }),
	handle: ({ params }) =>
		new Response(markdownFor(params.slug), {
			headers: { "content-type": "text/markdown; charset=utf-8" },
		}),
});
```

A `Response` says nothing about its body, so the client reads `data` as `never` for one — right for markdown, wrong for JSON that only wanted a status other than `200`. `json()` is that case: it sets the status and keeps the body's type.

```ts
import { handler, json } from "./$types";

export const POST = handler({
	body: NewIssue,
	handle: async ({ body }) => json(await createIssue(body), { status: 201 }),
});
```

```ts
const { data } = await api.POST("/api/issues", { body }); // the issue, not `never`
```

[`sse()`](/kit/server-routes#streaming) is the other one. It is still a `Response` — response handling is still skipped — but it says what its frames carry, so the client hands back the events rather than reading the stream to an end it does not have:

```ts
const { data } = await api.GET("/api/inbox/stream");
for await (const { data: notification } of data) show(notification);
```

Both come from `@implementjs/kit/server`, and a route's `./$types` re-exports them beside `handler`. With a `response` schema the schema is what types `data`, and returning any `Response` — a `json()` or an `sse()` included — still skips that validation.

`response` is optional, and the two choices differ in what they buy:

- **Declared.** What `handle` returns is checked against the schema at compile time, validated at runtime outside production (`validateResponse: false` turns that off, `true` turns it on everywhere), and documented in the OpenAPI output.
- **Omitted.** Nothing is validated and the type flows straight through from `handle` to the client. A typed client costs zero schemas.

Only schemas can become OpenAPI. Inference serves the client; the document describes whatever schemas you chose to write.

## Plain handlers still work

`handler()` returns a plain request handler. Nothing downstream knows it exists — the `405`/`Allow` computation, `export const prerender`, the prerenderer, and every adapter behave exactly as before, and a wrapped and an unwrapped handler sit happily in one file:

```ts
export const GET = handler({ handle: () => ({ ok: true }) });

export function HEAD(): Response {
	return new Response(null, { status: 200 });
}
```

A plain handler simply has nothing to tell the client, so its `data` type is `unknown`.

## The generated client

Kit generates a client for the app's endpoints and exports it ready to use. There is no setup and no configuration — it exists for every kit app.

```ts
import { api } from "$implement/client";

const { data, error } = await api.GET("/api/posts/[id]", {
	params: { id: "1" },
	query: { draft: true },
});
if (error !== undefined) return notFound(error.message);
render(data); // typed from the route's `response` schema, or from what `handle` returned
```

Routes are named by the URL they serve, params still in place — `/api/posts/[id]`, `/docs/[...slug].md`, the same ids [routing](/kit/routing) uses. An unknown route key, a method the route does not serve, a missing `params`, and a wrong `body` shape are all type errors.

The default `api` uses a relative base URL, which is what a browser wants. `createClient` is there for anything else:

```ts
import { createClient } from "$implement/client";

export const admin = createClient({
	baseUrl: "https://admin.example.com",
	headers: () => ({ authorization: `Bearer ${token()}` }),
});
```

### Error styles

`{ data, error, response }` is the default. Two others ship, selected once in `vite.config.ts`:

```ts
const { data, error } = await api.GET(...);  // "result" (default)
const post = await api.GET(...);              // "throw" — throws an ApiError
api.GET(...).match(render, handleError);      // "neverthrow" — returns a ResultAsync
```

```ts
kit({ api: { client: { errors: "throw" } } });
```

An `ApiError` carries the `status`, the parsed `body`, and the `response`. A request that never reached a server — offline, DNS, an aborted signal — is an `ApiError` with status `0`, so `error` is the only branch a caller has to handle.

The `neverthrow` style returns a `ResultAsync<Data, ApiError>`, which is already a `PromiseLike`: `.map`, `.andThen`, and `.match` chain straight off the call, and `await` is only for when you want the plain `Result`. It is the one style with a runtime dependency, so it ships as its own entry and `neverthrow` is an optional peer — apps on the other two styles never install it. Picking it without installing `neverthrow` fails codegen with a message saying so, rather than generating a client whose types quietly resolve to nothing.

### Call styles

`client.style` picks how a call reads. `"method"` is the default — `api.GET(path, …)`, as everything above. `"nested"` turns the flat client into a tree of the app's own routes, a segment at a time:

```ts
kit({ api: { client: { style: "nested" } } });
```

```ts
const { data, error } = await api.api.posts["[id]"].GET({ params: { id: "1" } });
await api.docs["[...slug].md"].GET({ params: { slug: "guide/install" } });
```

The tree is the route table's keys split on `/`, so every level offers only the segments that actually continue a route and the methods sit at the leaf — the same calls, the same options, reached by autocomplete instead of by typing a whole route key. A route at the root of the app is called straight off the client (`api.GET()`).

It composes with every error style, so `style` and `errors` are picked independently. One reservation comes with it: a route's own methods share a level with the routes nested under it, so the seven HTTP method names are taken and a path segment spelled `GET` is not reachable this way.

## `event.fetch` and `event.api`

Every load and every handler gets a `fetch` of its own on the request event. It resolves relative URLs against `event.url`, forwards `cookie` and `authorization` on same-origin requests, and — the part that matters — **dispatches a same-origin request in-process**: straight back through the request pipeline, hooks and all, with no socket in between.

`event.api` is the generated client bound to that fetch. So a load calling its own app's endpoint never leaves the process:

```ts
// src/routes/dashboard/page.server.ts
import type { LoadEvent } from "./$types";

export default async function load({ api }: LoadEvent) {
	const { data, error } = await api.GET("/api/posts/[id]", { params: { id: "1" } });
	if (error !== undefined) return { post: null };
	return { post: data };
}
```

That call runs the endpoint's handler as a function call. It costs no HTTP round trip out of the process and back, and it works during the prerender, where there is no server listening at all.

A handler that fetches itself is caught rather than left to exhaust the stack: kit caps the depth and says which route is looping.

> [!NOTE]
> `event.api` is typed through `App.Api`, which the generated `.implement/` types fill in from your own route tree — the same way `App.Locals` works. Nothing you write declares it.

## OpenAPI

An OpenAPI 3.1 document is **never** generated unless you ask for one. A route table is not something to publish by accident.

```ts
// vite.config.ts
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

With `api.openapi` absent — the default — no document is produced, no file is written, and no route is mounted. Individual routes opt out with `export const openapi = false;`.

`output` writes the document as a file. Point it inside `static/` and it ships as a plain static asset the host serves; kit answers the same URL in dev, built from the routes as they are right now rather than from whatever the last build left behind. The write is the build's own, not the prerender's: `prerender: false` — the usual setting for an app whose pages sit behind a session, and exactly the kind that wants a documented API — still gets the file.

`path` additionally mounts a live route that builds the document per server. That is the one option with a cost: generating the document needs the schema _objects_, so it pulls your schema library and its JSON-Schema converter into the production server bundle. `output` alone does the work in Node at build time, and neither ever reaches what you deploy.

A route's path parameters come from the route itself. `/api/items/[number=integer]` is documented as the template `/api/items/{number}` — a [matcher](/kit/routing) decides which requests reach the route, which is the app's business and not the URL's.

The parameter's type comes from the matcher's schema — which is the object that gates the segment, so the document describes exactly what the route accepts and cannot drift from it:

```ts
// src/params/integer.ts
export default matcher(v.pipe(v.string(), v.transform(Number), v.integer()));
```

```jsonc
{
	"name": "number",
	"in": "path",
	"required": true,
	"schema": { "type": "integer", "pattern": "^\\d+$" },
}
```

A handler's own `params` schema wins over the matcher where it declares one.

Standard Schema has no JSON-Schema introspection of its own, so conversion is per-vendor. Kit detects it from the schema's vendor tag — arktype's `.toJsonSchema()`, zod's `z.toJSONSchema`, valibot's `@valibot/to-json-schema` — each imported lazily, in Node only. Anything else is documented as an unconstrained schema with a build warning naming the route, or you can pass `toJsonSchema` yourself. An operation with no schemas is still listed, as a path and a method with an undocumented body.
