---
title: Routing
description: The file conventions, params, layouts, and generated types.
section: Guides
order: 10
---

Routes are directories under `src/routes`. A handful of file names mean something to kit, everything else in there is yours:

- `page.ts` is a page. It renders when the URL matches its directory.
- `layout.ts` wraps every page beneath it (including its own directory's page).
- `error.ts` renders when nothing matches or a render throws, for its own directory and everything under it.
- `page.server.ts` and `layout.server.ts` are [load functions](/kit/loading-data), and `server.ts` is a [server route](/kit/server-routes) — they run only on the server.

So a routes directory like this:

```
src/routes
	page.ts           → /
	layout.ts         → wraps everything
	error.ts          → the error page for everything below
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
import * as v from "valibot";

export default matcher(v.pipe(v.string(), v.digits()));
```

```
src/params
	integer.ts
src/routes
	users
		[id=integer]
			page.ts       → /users/42, but not /users/oops
```

A matcher is built from a [Standard Schema](https://standardschema.dev) — the same contract [`handler()`](/kit/api-routes) and [`defineEnv`](/kit/environment-variables) take, so it is a library you already have rather than one kit makes you add.

Constrain the **segment**, not just the value you parse it to. The schema's input is the string in the URL, and if you reach for a regex kit does not anchor it for you the way it once did — `v.regex(/\d+/)` accepts `12abc`, so write `/^\d+$/`, or `v.digits()` and skip the question.

Gating the route that way is [SvelteKit's feature](https://svelte.dev/docs/kit/advanced-routing#Matching), and it behaves the way you'd expect: `/users/oops` falls through to whatever else can serve it, and reaches the [error page](#the-error-page) if nothing can.

### Matchers that parse

Here's the part that goes further. A matcher doesn't have to answer yes or no — it can answer with a **value**, and that value is what the param is from then on. Not just at runtime: in the types, everywhere the param appears.

A schema that transforms is a schema that parses, so this is the same matcher with one more step:

```ts
// src/params/integer.ts
import { matcher } from "@implementjs/kit/params";
import * as v from "valibot";

export default matcher(v.pipe(v.string(), v.digits(), v.transform(Number)));
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

### Why a schema, and only a schema

`matcher()` takes a [Standard Schema](https://standardschema.dev) and nothing else — the same contract [`handler()`](/kit/api-routes) and [`defineEnv`](/kit/environment-variables) take, so it is a library you already have:

```ts
matcher(v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/))); // → Readable<string>
matcher(v.picklist(["en", "fr"])); // → Readable<"en" | "fr">
matcher(v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1))); // → Readable<number>
```

It has to validate synchronously; matching a route can't wait on a database.

Kit took a bare regex and a bare parse function once, and the parse function was a trap. `$types` reads what a matcher produces from the matcher module, so a parsing matcher typed its param `number` everywhere in the app — but the [OpenAPI document](/kit/api-routes) is written by a build, with no types to read, so it went on calling that param a string. The app was right, the document was wrong, and nothing anywhere said the two disagreed. A schema exists at runtime, so one object answers all three questions at once:

```ts
// src/params/integer.ts
export default matcher(v.pipe(v.string(), v.digits(), v.transform(Number), v.integer()));
```

```jsonc
{
	"name": "id",
	"in": "path",
	"required": true,
	"schema": { "type": "integer", "pattern": "^\\d+$" },
}
```

The object that just decided whether the route matches is the object the document is written from, so the document can't claim a constraint the route doesn't enforce, or miss one it does.

End the pipe with a check on the parsed value when you want the document to describe it. Every action kit's converter can represent goes in, from both sides of the transform — the `v.digits()` above becomes the `pattern`, the `v.integer()` becomes the `type`. Drop the `v.integer()` and the param is still a `number` in your code, but the document calls it a `string`, which is the segment it arrived as and not what the route hands you. It earns its place at runtime too: without it a four-hundred-digit segment parses to `Infinity` and matches.

Standard Schema is an interface, not a dependency, so an app that doesn't want a schema library can hand `matcher()` an object implementing it directly:

```ts
export default matcher({
	"~standard": {
		version: 1,
		vendor: "my-app",
		validate: (value: unknown) =>
			typeof value === "string" && /^\d+$/.test(value)
				? { value: Number(value) }
				: { issues: [{ message: "not an integer" }] },
	},
} as const);
```

That one has no vendor kit knows how to convert, so its param is documented as an unconstrained schema with a build warning naming the route — the cost of skipping the library, and said out loud rather than silently.

### What matching does with them

- A matched param **outranks a plain one** at the same position, the way a static segment outranks both. So `[id=integer]` and `[slug]` can sit side by side: `/users/42` goes to the first, `/users/ada` to the second.
- A matcher on a catch-all sees the **joined remainder**: `[...slug=word]` runs the matcher over `"a/b"`, not over each segment.
- The same param name can be bound by two siblings behind **different** matchers — `[id=integer]` and `[id=uuid]` are different routes.
- Matching runs on both sides of a navigation, so a client-side navigation to a path no matcher accepts renders the error page without a round trip.
- The route's id keeps the matcher in it: `event.route.id` is `/users/[id=integer]`, and so is the key the generated client uses.

Naming a matcher the app doesn't have is a scan error, not a route that quietly never matches. Matchers live in `src/params` by default; point `kit({ params: "..." })` somewhere else if you'd rather.

## The error page

An `error.ts` renders whenever no route matches, or a page or layout throws while rendering. It receives the `error`, just like SvelteKit:

```ts
// src/routes/error.ts
import { H1, P } from "@implementjs/core";
import type { ErrorProps } from "./$types";

export default function ErrorPage({ error }: ErrorProps) {
	return [H1(`${error.code}`), P(error.message)];
}
```

`error.code` is an HTTP-style status — `404` when no route matched, `500` when a render threw — and `error.message` describes it. Throw a `{ code, message }` object from a page to surface a custom status: `throw { code: 403, message: "Forbidden" }`.

### Error pages nest

An `error.ts` may sit in any route directory, and it covers that directory and everything under it. The nearest one up the tree wins, so a section can answer for itself and the root one stays the fallback:

```
src/routes
	error.ts              → everything else
	app
		[slug]
			layout.ts         → the app shell
			layout.server.ts
			error.ts          → anything under /app/:slug
			issue
				[id]
					page.ts
```

A 404 at `/app/acme/issue/9999` renders `app/[slug]/error.ts` **inside the layouts around it** — the app shell, and the root layout around that — the same chain the page it replaced would have rendered in. The sidebar, the workspace switcher, and the way back stay on screen; only the page is gone. A 404 at `/pricing/nope` has no section boundary above it, so it falls through to the root `error.ts`, which renders in the root layout.

Those layouts get their `data` too: kit runs the load chain of the boundary's directory before it renders the error page, so a shell that reads `data` from its `layout.server.ts` is a real shell rather than an empty one. The boundary's own params come with it, so `/app/:slug` still knows which workspace the 404 was in.

An app with no `error.ts` at all answers in plain text with the status and the message — there is no page to render. When a **root** one exists, the build also writes a `404.html` so static hosts serve it for unknown URLs; a section boundary cannot answer for a path a static host has never heard of.

## $implement/router

Everything kit generates hangs off one virtual module, `$implement/router`. It exports the assembled [router](/docs/router), typed against your route tree, so you get typed links and navigation anywhere in your app:

```ts
import { router } from "$implement/router";

router.Link({ to: "/users/:id", params: { id: user.id } }, "Profile");
router.navigate("/docs");
```

A typo'd path or a missing param is a compile error, the declaration for the module regenerates whenever your routes change.

## While you work

The dev server watches the routes directory. Add or delete a route file and kit rescans, regenerates the types, and reloads the page.

Editing the inside of one is hot module replacement, scoped to the route. Every `page.ts` and `layout.ts` accepts its own updates in dev, so an edit stops at the route file that renders it: kit swaps the component behind the route and asks the router to rebuild from that file's position in the chain. A page re-renders inside layouts that never unmounted — their DOM, their subscriptions, and their state stay exactly as they were, scroll position included. Edit a layout and everything above it survives instead.

A file that is not itself a route — a component, a helper, a store — has no boundary of its own, so its update climbs to the route files that import it, and those re-render. Only the route on screen actually rebuilds; the rest just take the new code for the next time you navigate to them.

Three things still reload the page, because nothing on the client can answer them:

- **A route appearing or disappearing.** The route tree the router was built from is no longer the one on disk.
- **A `server.ts`, `page.server.ts`, `layout.server.ts` or `hooks.server.ts` edit.** The browser is holding the output of a load, not the load; a reload re-renders against the new one.
- **An edit that reaches no route file**, such as a param matcher under `src/params/`. Vite runs out of importers and says so.

State inside the subtree that rebuilds does not survive — the same trade every framework without a compiler makes. Put what you want to keep across an edit of its own page in a module-scope signal: modules outside the update's import chain are never re-executed.
