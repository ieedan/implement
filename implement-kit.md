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
a load, SvelteKit-style. It receives `{ params, url }` (`params` as plain
strings) and returns a JSON-serializable object:

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
method (`GET`, `POST`, …), receiving `{ request, params, url }` and returning
a web-standard `Response`. A directory serves a page or an endpoint, not both.

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

## Environment Variables (Phase 3)

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

Kit has no production server, so a server env var is a **build-time secret**:
`DATABASE_URL` is read during `vite build`, not per request. There is no
`$env/dynamic` counterpart to design yet — that is additive work for the adapter
phase, when non-GET endpoints can ship.

A missing or malformed variable fails the build with no opt-out, reporting every
failing key at once. This is lazy at module granularity: an app that never
imports `env.server.ts` never validates it.
