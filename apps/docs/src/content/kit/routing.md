---
title: Routing
description: The file conventions, params, layouts, and generated types.
section: Guides
order: 10
---

Routes are directories under `src/routes`. A handful of file names mean something to kit, everything else in there is yours:

- `page.ts` is a page. It renders when the URL matches its directory.
- `layout.ts` wraps every page beneath it (including its own directory's page).
- `error.ts` at the routes root renders when nothing matches or a render throws.
- `page.server.ts` and `layout.server.ts` are [load functions](/kit/loading-data), and `server.ts` is a [server route](/kit/server-routes) — they run only on the server.

So a routes directory like this:

```
src/routes
	page.ts           → /
	layout.ts         → wraps everything
	error.ts          → the 404 page
	docs
		page.ts         → /docs
		layout.ts       → wraps /docs and /docs/*
		[...slug]
			page.ts       → /docs/anything/below
	users
		[id]
			page.ts       → /users/:id
```

Any other file is colocated code and kit ignores it, so keep your components, helpers, and tests right next to the routes that use them. Dot-directories are skipped too.

A file that only just misses one of those names is the exception. `+server.ts`, `page.tsx`, `+page.svelte` — a name kit would route if you dropped a `+` or wrote `.ts` — gets a warning from the dev server and the build:

```
12:00:00 [implement] unknown file "src/routes/api/+server.ts" — did you mean "server.ts"? Anything else in the routes tree is colocated code, so this file routes nothing.
```

The file is still ignored, it just no longer goes unmentioned: a misnamed route is invisible otherwise, and looks exactly like a route that does not work.

## Pages

A page default-exports a function that receives `params` and `url`:

```ts
// src/routes/users/[id]/page.ts
import { H1 } from "@implementjs/core";
import type { PageProps } from "./$types";

export default function Page({ params, url }: PageProps) {
	return H1("User: ", params.id);
}
```

The `./$types` module is generated per route directory, so `params` is typed with exactly the params that exist at that level. A page under `[id]` gets `{ id: Readable<string> }`, the root page gets `{}`.

Notice params are signals, not strings. Navigating from `/users/1` to `/users/2` doesn't remount the page, the router patches the param in place. Render `params.id` directly and it stays up to date, and use `params.id.onChange(refetch)` or [`Key`](/docs/key) when a change should reload data. This is `@implementjs/router`'s behavior, read [Params are signals](/docs/router#params-are-signals) for the details.

`url` is the router's location, a `Readable<RouterLocation>` of `{ path, search, hash }`.

## Layouts

A layout receives `children` on top of the page props. Render it where the matched content should go:

```ts
// src/routes/layout.ts
import { Div, Main } from "@implementjs/core";
import type { LayoutProps } from "./$types";

export default function Layout({ children }: LayoutProps) {
	return Div(SiteHeader(), Main(children));
}
```

Layouts are persistent. Navigating between two pages under the same layout doesn't remount it, so sidebar scroll position and local state survive. Only the diverging part of the route chain swaps.

## Dynamic segments

Wrap a directory name in brackets to bind a param, just like SvelteKit:

- `[id]` matches one segment and binds it as `id`.
- `[...slug]` is a catch-all. It matches one or more remaining segments joined with `/`, so `docs/[...slug]` matches `/docs/a` and `/docs/a/b` (but not `/docs` itself, give the `docs` directory its own `page.ts` for that). Nothing can nest below a catch-all.

Static segments always beat params at the same position, so `/users/new` wins over `/users/[id]` no matter what order the directories sort in. The same param name can't be bound twice on one path.

## Param matchers

`[id]` matches any segment, which means `/users/oops` reaches the page and the page has to deal with it. A **matcher** moves that decision up to routing: a matcher lives in `src/params/<name>.ts`, a `[id=<name>]` directory names it, and a segment the matcher turns down never becomes a match at all.

```ts
// src/params/integer.ts
import { matcher } from "@implementjs/kit/params";

export default matcher(/\d+/);
```

```
src/params
	integer.ts
src/routes
	users
		[id=integer]
			page.ts       → /users/42, but not /users/oops
```

A pattern has to match the whole segment — kit anchors it for you, so `/\d+/` means "digits and nothing else". That much is [SvelteKit's feature](https://svelte.dev/docs/kit/advanced-routing#Matching), and it behaves the way you'd expect: `/users/oops` falls through to whatever else can serve it, and reaches the [error page](#the-error-page) if nothing can.

### Matchers that parse

Here's the part that goes further. A matcher doesn't have to answer yes or no — it can answer with a **value**, and that value is what the param is from then on. Not just at runtime: in the types, everywhere the param appears.

Return `mismatch` to turn a segment down, and anything else to accept it:

```ts
// src/params/integer.ts
import { matcher, mismatch } from "@implementjs/kit/params";

export default matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});
```

Now `params.id` is a `number`:

```ts
// src/routes/users/[id=integer]/server.ts
import { handler } from "./$types";

export const GET = handler({
	handle: ({ params }) => db.user(params.id),
	//                             ^? number
});
```

```ts
// src/routes/users/[id=integer]/page.ts
import type { PageProps } from "./$types";

export default function Page({ params }: PageProps) {
	//                          ^? { id: Readable<number> }
	return H1("user #", params.id);
}
```

Nothing declares that type twice. The generated `./$types` reads it straight off the matcher module, so changing what `src/params/integer.ts` returns changes every route that names it — pages, layouts, loads, `server.ts` handlers, and the [generated client](/kit/api-routes).

### Three ways to write one

`matcher()` takes a pattern, a parse function, or any [Standard Schema](https://standardschema.dev) — the same contract [`handler()`](/kit/api-routes) and [`defineEnv`](/kit/environment-variables) use:

```ts
import * as z from "zod";
import { matcher, mismatch } from "@implementjs/kit/params";

// a pattern — the param stays a string
export default matcher(/[a-z0-9-]+/);

// a parse — the param is whatever you return
export default matcher((value) => (value === "en" || value === "fr" ? value : mismatch));
//                                  → Readable<"en" | "fr">

// a schema — the param is the schema's output
export default matcher(z.coerce.number().int().positive());
//                                  → Readable<number>
```

A schema has to validate synchronously; matching a route can't wait on a database. Reach for a schema when you want its parsing (`z.coerce.number()`, `z.iso.date()`), a pattern when a regex says it, and a function when neither does.

### What matching does with them

- A matched param **outranks a plain one** at the same position, the way a static segment outranks both. So `[id=integer]` and `[slug]` can sit side by side: `/users/42` goes to the first, `/users/ada` to the second.
- A matcher on a catch-all sees the **joined remainder**: `[...slug=word]` runs the matcher over `"a/b"`, not over each segment.
- The same param name can be bound by two siblings behind **different** matchers — `[id=integer]` and `[id=uuid]` are different routes.
- Matching runs on both sides of a navigation, so a client-side navigation to a path no matcher accepts renders the error page without a round trip.
- The route's id keeps the matcher in it: `event.route.id` is `/users/[id=integer]`, and so is the key the generated client uses.

Naming a matcher the app doesn't have is a scan error, not a route that quietly never matches. Matchers live in `src/params` by default; point `kit({ params: "..." })` somewhere else if you'd rather.

## The error page

A root `error.ts` renders whenever no route matches, or a page or layout throws while rendering. It receives the `error`, just like SvelteKit:

```ts
// src/routes/error.ts
import { H1, P } from "@implementjs/core";
import type { ErrorProps } from "./$types";

export default function ErrorPage({ error }: ErrorProps) {
	return [H1(`${error.code}`), P(error.message)];
}
```

`error.code` is an HTTP-style status — `404` when no route matched, `500` when a render threw — and `error.message` describes it. Throw a `{ code, message }` object from a page to surface a custom status: `throw { code: 403, message: "Forbidden" }`.

It's root-only for now, kit will refuse an `error.ts` anywhere deeper. When it exists, the build also writes a `404.html` so static hosts serve it for unknown URLs.

## $implement/router

Everything kit generates hangs off one virtual module, `$implement/router`. It exports the assembled [router](/docs/router), typed against your route tree, so you get typed links and navigation anywhere in your app:

```ts
import { router } from "$implement/router";

router.Link({ to: "/users/:id", params: { id: user.id } }, "Profile");
router.navigate("/docs");
```

A typo'd path or a missing param is a compile error, the declaration for the module regenerates whenever your routes change.

## While you work

The dev server watches the routes directory. Add or delete a route file and kit rescans, regenerates the types, and reloads the page. Editing the inside of a page is just normal Vite HMR.
