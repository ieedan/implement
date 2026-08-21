# ImplementKit `@implementjs/kit`

An initial spec document for a full stack framework for implement built on top of vite.

## Routing File/Folder Structure (Phase 1)

Pages will always be named `index.ts` and layouts will be named `layout.ts`.

Parameters made by wrapping a name in `[]` you can use `...` as a catch all. (Just like in SvelteKit)

We will have type-generation for the Page and Layout files just like SvelteKit does that allows the arguments of pages and layouts to be typed.

```
src/routes
    /docs
        /[...slug]
            /.md
                server.ts
            index.ts
            layout.ts
        index.ts
        layout.ts
    index.ts
    index.server.ts
    layout.ts
    layout.server.ts
```

```ts src/routes/index.ts
export default function Page() {}
```

```ts src/routes/layout.ts
export default function Layout({ children }) {
	children; // Child this will be a Page. Page is just a fragment
}
```

```ts src/routes/docs/[...slug]/index.ts
export default function Page({ params, url }) {
	// these are not readable because Page will re-render whenever the URL changes (outside of like hash and search params)
	params.slug; // string
	url; // URL
}
```

## Route Groups & Layout Resets

(Just like in SvelteKit.)

A `(group)` directory scopes a layout without contributing a URL segment, so
sibling trees can share a layout the URL never shows:

```
src/routes
    /(authed)
        layout.ts            wraps everything in the group
        /dashboard
            index.ts         -> /dashboard
    /(marketing)
        layout.ts
        /about
            index.ts         -> /about
    index.ts                 -> /
```

Two pages may not resolve to the same path through different groups — the scan
rejects that.

`@` in a page or layout filename resets which layouts it inherits. The name
after `@` is the ancestor directory segment whose layout chain to keep; `@`
alone resets to the root layout:

```
index@.ts            page rendered with only the root layout
index@(authed).ts    page keeps layouts up to and including (authed)
layout@.ts           this layout inherits only the root layout
layout@(authed).ts   this layout inherits up to and including (authed)
```

Resets never change the URL — only which layouts wrap the page.

## Project Structure & Static Files

The default shape of a kit app:

```
my-app/
    /src
        /lib             @/lib alias, configured automatically (Vite + generated tsconfig)
            /components
            utils.ts
        /routes
        index.html       the html shell, pointed at the generated client entry
        app.css          global css, imported from the root layout
        app.d.ts         App.Locals — what hooks.server.ts hands the routes
        hooks.server.ts  runs on every server request
    /static              served as-is from the site root, copied into dist on build
```

Vite only serves an `index.html` at the project root, so kit serves `src/index.html`
itself in dev and moves it back to the root of `dist/` on build. A root `index.html`
still works for apps that want it there.

`static/` is Vite's `publicDir` — kit defaults it to `static` but a `publicDir`
set in the app's Vite config wins.

Extra aliases (SvelteKit-style) go through the plugin, which wires them into
Vite and the generated tsconfig together:

```ts
kit({ alias: { "@/content": "src/content" } });
```

## Server Files (Phase 2)

Implemented. Server files run only on the server — dev requests and the
build's prerender — and never reach the browser bundle.

### `*.server.ts` load functions

`index.server.ts` / `layout.server.ts` next to a page or layout default-export
a load, SvelteKit-style. It receives the request event — `{ params, url,
request, locals, … }`, `params` as plain strings — and returns a
JSON-serializable object:

```ts
// src/routes/blog/[slug]/index.server.ts
export default async function load({ params, url }) {
	return { post: await getPost(params.slug) };
}
```

The page or layout receives the merged results as `data`. Like `params`, it is
a **readable** (not the plain object the original sketch showed) because the
router patches param-only navigations in place instead of remounting — kit
reseeds the store and the readable updates:

```ts
export default function Page({ data }) {
	data; // Readable of the merged load results, typed via ./$types PageData
}
```

Layout loads flow down: a page's `data` merges every layout load above it plus
its own, and `@` layout resets reset the data chain the same way they reset
layouts. Plumbing: the server render embeds the data in the HTML for
hydration; client navigation fetches `<path>/__data.json` (a dev endpoint, a
static file after prerender) before the navigation commits.

### `server.ts` endpoints

A `server.ts` in a route directory is an endpoint exporting a handler per HTTP
method (`GET`, `POST`, …), receiving the same request event and returning a
web-standard `Response`. A directory serves a page or an endpoint, not both.

A `.<ext>` directory holding a `server.ts` is an extension route — it serves
the parent path with the extension appended, which is how the docs site serves
every page's markdown twin:

```
src/routes/docs
	.md/server.ts             → /docs.md
	[...slug]
		index.ts                → /docs/<slug>
		.md/server.ts           → /docs/<slug>.md
```

On build, `GET` endpoints prerender into real files (extension endpoints over
params derive their paths from the prerendered pages); other methods work in
dev and will need a server adapter to ship.

## Server Hooks (Phase 3)

Implemented. `src/hooks.server.ts` wraps every server request — pages,
endpoints, and the `__data.json` payload behind a client navigation — the same
way SvelteKit's does:

```ts
// src/hooks.server.ts
import type { Handle } from "@implementjs/kit/server";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await getUser(event.request.headers.get("cookie"));
	return await resolve(event);
};
```

`resolve(event)` produces the response the route would have given; returning
something else instead short-circuits the route. `event.locals` is per-request
state the route's loads and endpoint handlers read, typed by the app through
`App.Locals` in `src/app.d.ts`. Alongside `handle` the file may export
`handleError` (what to do with an unexpected throw, and what the error page
renders) and `init` (awaited once before the first request); `sequence`,
`error`, and `redirect` come from `@implementjs/kit/server`.

Hooks run in dev and during the build's prerender. A hook that answers a
prerendered page with its own response fails the build — a static file cannot
represent one.
