---
title: Server Hooks
description: hooks.server.ts runs on every server request — middleware, locals, and error handling.
section: Guides
order: 14
---

Some work belongs in front of every route: reading a session cookie, timing a request, adding a header, turning an unauthenticated visitor around. Kit's answer is the same as SvelteKit's — a `src/hooks.server.ts` that wraps every server request.

```ts
// src/hooks.server.ts
import type { Handle } from "@implementjs/kit/server";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await getUser(event.request.headers.get("cookie"));
	return await resolve(event);
};
```

`handle` is called for every request the app serves: a page, a [`server.ts` endpoint](/kit/server-routes), and the `__data.json` payload a client navigation fetches. `resolve(event)` is the rest of kit — routing, loads, the render — and it hands you back the `Response`, which you can inspect, change, or replace. Skip the call entirely and the route never runs:

```ts
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith("/admin") && event.locals.user === null) {
		return new Response("Unauthorized", { status: 401 });
	}
	return await resolve(event);
};
```

The file is server-only, like `*.server.ts` — it never reaches the browser bundle, so it can read secrets, touch the filesystem, and talk to a database.

## The event

`event` is the `RequestEvent` your endpoints and loads receive too:

| Property           | What it is                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `request`          | The web-standard `Request`, headers and body included.                                   |
| `url`              | Its `URL`. For a `__data.json` request this is the **page's** URL, not the data path.    |
| `params`           | The matched route's params, as plain strings.                                            |
| `route.id`         | The matched route in directory form (`/docs/[...slug]`), or `null` when nothing matched. |
| `locals`           | Yours to fill in — see below.                                                            |
| `isDataRequest`    | `true` for the `__data.json` fetch behind a client navigation.                           |
| `setHeaders`       | Adds headers to the response `resolve` produces. One value per header, and no cookies.   |
| `getClientAddress` | The requesting address.                                                                  |

## Locals

`event.locals` is a plain object, fresh for every request. Whatever `handle` puts there, the route's loads and endpoint handlers read:

```ts
// src/routes/account/page.server.ts
import type { LoadEvent } from "./$types";

export default function load({ locals }: LoadEvent) {
	return { user: locals.user };
}
```

```ts
// src/routes/api/me/server.ts
import type { RequestEvent } from "./$types";

export function GET({ locals }: RequestEvent): Response {
	return Response.json(locals.user);
}
```

You type it once, in `src/app.d.ts`, and it is typed everywhere:

```ts
// src/app.d.ts
import type { User } from "@/lib/auth";

declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
}

export {};
```

`App` is a global namespace kit declares and your file merges into — the same pattern SvelteKit uses. `App.Error` is the other member: the shape `handleError` returns and your [error page](/kit/routing#the-error-page) renders. It is `{ message: string }` unless you widen it.

## Redirects and errors

Two helpers throw the response instead of returning it, so they work anywhere in the chain — a hook, a load, an endpoint:

```ts
import { error, redirect, type Handle } from "@implementjs/kit/server";

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith("/app") && event.locals.user === null) {
		redirect(303, "/login");
	}
	if (event.locals.user?.banned) error(403, "Your account is suspended");
	return await resolve(event);
};
```

`redirect(status, location)` ends the request with a `Location` header. `error(status, body)` ends it with that status: pages render your `error.ts` with the message, endpoints and data requests get it as JSON. Neither reaches `handleError` — they're the outcomes you asked for, not failures.

## handleError

Anything else thrown out of a hook, a load, or an endpoint is unexpected. `handleError` sees it, and what it returns becomes the error the response carries:

```ts
// src/hooks.server.ts
import type { HandleServerError } from "@implementjs/kit/server";

export const handleError: HandleServerError = ({ error, event }) => {
	reportToSentry(error, { route: event.route.id });
	return { message: "Something went wrong" };
};
```

Without one, kit logs the error and answers `Internal Error`. Either way the status is `500`, and a page request renders your `error.ts`.

In dev, the terminal always gets the failure — whether or not you wrote a `handleError`, and whether the request was a page, a `__data.json` payload, or an endpoint. Kit names the request and the server file it came from, and trims the stack to your own code:

```
GET /docs/install → 500 — load in src/routes/docs/[...slug]/page.server.ts

Error: no such file
    at readDoc (src/lib/docs.ts:14:9)
    at load (src/routes/docs/[...slug]/page.server.ts:6:10)
    … 7 frames outside your app
```

The build prints the same block when a load or an endpoint throws while its `__data.json` payload or static response is being written, instead of quietly writing one file fewer.

An unmatched path is a `404` with the same error page — a kit dev server no longer answers every URL with `200`.

## Transforming the page

`resolve` takes a second argument for shaping the render itself. `transformPageChunk` runs over the finished document:

```ts
export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace("%theme%", themeFor(event)),
	});
```

Kit renders a page in one pass, so it is called once with the whole document and `done: true`.

## Composing hooks

One `handle` export, several concerns — `sequence` chains them:

```ts
import { sequence, type Handle } from "@implementjs/kit/server";

const authenticate: Handle = async ({ event, resolve }) => {
	event.locals.user = await getUser(event.request.headers.get("cookie"));
	return await resolve(event);
};

const timing: Handle = async ({ event, resolve }) => {
	const start = performance.now();
	const response = await resolve(event);
	response.headers.set("x-render-time", `${Math.round(performance.now() - start)}ms`);
	return response;
};

export const handle = sequence(authenticate, timing);
```

Handlers run left to right on the way in and unwind right to left on the way out, so `authenticate` sets `locals` before `timing` resolves, and `timing`'s header lands on the response `authenticate` returns. `transformPageChunk` options merge too — an inner handler's transform runs before the ones wrapping it.

## init

`init` is awaited once, before the first request is handled — the place for a database connection or a config check:

```ts
export const init = async () => {
	await db.connect();
};
```

## When hooks run

Hooks are server-side, so they run wherever kit runs a server request:

- **In dev**, for every request that reaches the app — pages, endpoints, and `__data.json`. Assets under `static/` and Vite's own dev URLs are served before the pipeline, and never see `handle`.
- **On build**, for every prerendered page, endpoint, and data payload. That's how a `locals` value reaches the loads of a prerendered route — it is computed once, at build time, and frozen into the output.

A prerendered page has no request to answer, so a hook that returns its own response for one — a redirect, a `401` — fails the build with the route that hit it. Guards like that belong on routes a real server handles.

There is no `handleFetch`: loads don't have an `event.fetch` to intercept yet. Cookies are plain headers here — read `event.request.headers.get("cookie")` and set them on the response.

## The file itself

`src/hooks.server.ts` is the default. Point kit somewhere else if you want:

```ts
kit({ hooks: "src/server/hooks.ts" });
```

Edits apply on the next request in dev, like the rest of your server code.
