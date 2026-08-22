# ImplementKit `@implementjs/kit`

An initial spec document for a full stack framework for implement built on top of vite.

## Routing File/Folder Structure (Phase 1)

Pages will always be named `page.ts` and layouts will be named `layout.ts`.

Parameters made by wrapping a name in `[]` you can use `...` as a catch all. (Just like in SvelteKit)

We will have type-generation for the Page and Layout files just like SvelteKit does that allows the arguments of pages and layouts to be typed.

```
src/routes
    /docs
        /[...slug]
            /.md
                server.ts
            page.ts
            layout.ts
        page.ts
        layout.ts
    page.ts
    page.server.ts
    layout.ts
    layout.server.ts
```

```ts src/routes/page.ts
export default function Page() {}
```

```ts src/routes/layout.ts
export default function Layout({ children }) {
	children; // Child this will be a Page. Page is just a fragment
}
```

```ts src/routes/docs/[...slug]/page.ts
export default function Page({ params, url }) {
	// these are not readable because Page will re-render whenever the URL changes (outside of like hash and search params)
	params.slug; // string
	url; // URL
}
```

## Param Matchers

A `src/params/<name>.ts` default-exports a `matcher()`, and a `[id=<name>]`
directory names it. A segment the matcher turns down is not a match, so the
path falls through to the next route and reaches the error page rather than a
handler that has to check for itself.

Beyond SvelteKit: a matcher may parse the segment, and what it returns is what
the param is downstream — in `event.params`, in a page's `params`, and in the
generated client, typed off the matcher module by the generated `./$types`.

```ts src/params/integer.ts
import { matcher, mismatch } from "@implementjs/kit/params";

export default matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});
```

```ts src/routes/posts/[id=integer]/server.ts
export const GET = handler({ handle: ({ params }) => db.post(params.id) });
//                                                          ^? number
```

`matcher()` also takes a regex (anchored to the whole segment) or any Standard
Schema. A matched param outranks a plain one at the same position, so
`[id=integer]` and `[slug]` can be siblings. Naming a matcher the app does not
have is a scan error.

## Route Groups & Layout Resets

(Just like in SvelteKit.)

A `(group)` directory scopes a layout without contributing a URL segment, so
sibling trees can share a layout the URL never shows:

```
src/routes
    /(authed)
        layout.ts            wraps everything in the group
        /dashboard
            page.ts          -> /dashboard
    /(marketing)
        layout.ts
        /about
            page.ts          -> /about
    page.ts                  -> /
```

Two pages may not resolve to the same path through different groups — the scan
rejects that.

`@` in a page or layout filename resets which layouts it inherits. The name
after `@` is the ancestor directory segment whose layout chain to keep; `@`
alone resets to the root layout:

```
page@.ts             page rendered with only the root layout
page@(authed).ts     page keeps layouts up to and including (authed)
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
        /params          route param matchers, one <name>.ts per [id=<name>]
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

`page.server.ts` / `layout.server.ts` next to a page or layout default-export
a load, SvelteKit-style. It receives the request event — `{ params, url,
request, locals, … }`, `params` as plain strings — and returns a
JSON-serializable object:

```ts
// src/routes/blog/[slug]/page.server.ts
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
		page.ts                 → /docs/<slug>
		.md/server.ts           → /docs/<slug>.md
```

On build with no adapter, `GET` endpoints prerender into real files (extension
endpoints over params derive their paths from the prerendered pages) and other
methods work in dev only. With an adapter every method ships — see
[Adapters](#adapters-phase-5).

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

## Environment Variables (Phase 4)

Implemented. Two user-authored files, both evaluated in Node at build time and
re-emitted as literals, so no schema library ever enters a bundle:

- `src/lib/env.public.ts` — safe to ship, inlined into the browser bundle.
- `src/lib/env.server.ts` — server-only; the client copy holds no values at all.

```ts
// src/lib/env.public.ts
import { defineEnv } from "@implementjs/kit";
import { z } from "zod";

export const env = defineEnv({ PUBLIC_DOCS_URL: z.url() });
```

`defineEnv` is a plain generic function over [Standard Schema](https://standardschema.dev),
so `typeof env` infers straight through and no codegen is involved — `sync()`
stays env-unaware, and `pnpm check` in CI never needs a populated `.env`.

Two files rather than one virtual module because a single specifier cannot have
two types. Two imports on the server rather than a merged `env` because a merge
would leave TypeScript seeing only one file's keys, and because a variable's
exposure should be readable at the call site.

### The `PUBLIC_` prefix

Fixed and not configurable: every key in `env.public.ts` must start with
`PUBLIC_`, and no key in `env.server.ts` may. The type system was never going to
catch the mistake that actually happens — pasting `DATABASE_URL` into the public
file — and a prefix is visible at every call site.

### Enforcement

`env.server.ts` is a server file under the rule that already governs
`db.server.ts`; there is no env-specific guard logic.

- **Layer 1 — the static guard.** A client-graph module importing a `*.server.ts`
  specifier is an error, in dev and on build, reported with the importer chain
  (`$implement/router` imports every page eagerly, so the chain is what makes it
  actionable). Type-only imports are erased before the module graph sees them and
  stay legal; an inline `type` specifier under `verbatimModuleSyntax` does not,
  and is a documented papercut.
- **Layer 2 — the module itself.** The client copy of any `*.server.ts` keeps its
  export shape and throws on evaluation. The backstop for computed dynamic
  imports and re-export chains — and the reason a leak stays impossible even if
  Layer 1 is bypassed.

### Scope

Both files are evaluated once, during `vite build`, so a server env var is a
**build-time value**: `DATABASE_URL` is read during the build and baked into
what it produces — the prerendered pages with no adapter, the server bundle
with one. Rotating it means rebuilding, and the artifact holds the secret.

A `$env/dynamic` counterpart — validated, typed, read per request — is the
obvious next piece, and is additive on top of this.

A missing or malformed variable fails the build with no opt-out, reporting every
failing key at once. This is lazy at module granularity: an app that never
imports `env.server.ts` never validates it.

## Adapters (Phase 5)

Implemented. `kit({ adapter })` decides what the build produces. Without one,
`vite build` writes a static site into `build.outDir` and anything that has to
run when a request arrives has nowhere to go. With one, the build is staged
under `.implement/output` — `client/`, holding the browser bundle with
everything prerendered into it, and `server/`, a second Vite build of the app's
request pipeline — and the adapter turns that pair into the shape its host
deploys.

```ts
// vite.config.ts
import { kit } from "@implementjs/kit";
import adapter from "@implementjs/adapter-node";

export default defineConfig({ plugins: [kit({ adapter: adapter() })] });
```

Four adapters ship: `@implementjs/adapter-static` (plain files, with an SPA
fallback and a check that no route was left without one),
`@implementjs/adapter-node` (a directory `node dist` serves),
`@implementjs/adapter-vercel` (Build Output API v3), and
`@implementjs/adapter-cloudflare` (a module worker bundled for `workerd`, with
the worker's bindings on `event.platform`).

The server build runs on the same config as the client one, so the app's
plugins, aliases, and env replacement apply to both. What differs is the entry,
the output, and what may stay external: a host that uploads a single artifact
bundles everything, a Node server next to its own `node_modules` does not.

### The handler

`@implementjs/kit/handler` is what a built app ships: web-standard `Request` in,
`Response` out, with no `node:*` anywhere in its graph, so the same module runs
behind a Node server, a serverless function, and a worker. Everything
platform-specific stays outside it — an adapter serves the static assets and
the prerendered pages however its host does, and hands whatever misses to the
handler. `@implementjs/kit/node` carries the `node:http` bridge (the dev
middleware uses the same one) and the static, prerendered, and app middlewares
a Node host composes.

An adapter that needs its own shape of entry point — a worker's
`export default { fetch }`, a platform's request signature — supplies
`build.entry`, which imports the app through the `$implement/handler` virtual
module. `event.platform` is what the host hands the app through it: Cloudflare's
`env` and `ctx`, typed by the app through `App.Platform`.

### Prerendering becomes per route

A server changes what is worth prerendering, because a page whose load reads
the session must not be frozen at build time. Routes declare `export const
prerender` from their server files — the nearest one to the page wins, so a
layout can turn a section on and one page under it can opt back out — and the
default follows the adapter: everything without one, and with a server, only
what has no server load behind it. The crawl that discovers routes filters as
it walks, so a page that will be rendered per request never has its loads run
during the build.

## Open Graph Images (Phase 6)

Implemented. `@implementjs/kit/og` renders an image from implement components
and returns it as a `Response`:

```ts
// src/routes/blog/[slug]/.png/server.ts
import { Div, ImageResponse } from "@implementjs/kit/og";
import type { RequestEvent } from "./$types";

export function GET({ params }: RequestEvent): Response {
	return new ImageResponse(Div({ style: { display: "flex", fontSize: 64 } }, params.slug), {
		width: 1200,
		height: 630,
	});
}
```

The api is `@vercel/og`'s — same constructor, same options object, same
defaults, same `Response` semantics — with components in place of JSX. Satori,
which does the layout, documents a plain `{ type, props }` tree as an input
alongside React elements, and that is what a render already produces: core's
`renderToTree` stops one step short of the html string and hands the tree over,
so nothing is serialized and re-parsed, and no jsx runtime is involved.

The route needs nothing new either. A `.png` extension route is the same
mechanism as the docs site's `.md` twins, so an image route beside a page
prerenders one file per page, and the prerenderer already wrote endpoint
bodies as bytes.

What the module adds on top of satori is the part that is not a rendering
concern: css values (core stringifies a style prop, so bare numbers get their
`px` back, following React's unitless list), raw markup (`Svg` and
`Implement.Html` keep their content unparsed, which is every lucide icon, so
those subtrees are parsed into nodes), a vendored font (satori has no system
fonts and no fallback, so an image with no `fonts` would be an image with no
text), and satori's `tw` prop, typed by re-exporting core's element factories
with `tw` and a numeric `style` rather than putting either in core.

### The rasterizer is native, for now

Satori emits svg; the png comes from `@resvg/resvg-js`, a native addon. Both
are imported lazily, so a route that never renders an image never loads them,
and the server build leaves the addon external because a `.node` binary has no
bundled form. The consequence is that per-request images work on a host with
its own `node_modules` and not inside a bundled function or a worker.
Prerendered images are unaffected — the build renders them.

Moving to `@resvg/resvg-wasm` lifts that restriction and is the obvious next
piece: same api, same output, additive on top of this.
