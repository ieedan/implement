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
    /static              served as-is from the site root, copied into dist on build
    index.html
    app.css              global css, imported from the root layout
```

`static/` is Vite's `publicDir` — kit defaults it to `static` but a `publicDir`
set in the app's Vite config wins.

Extra aliases (SvelteKit-style) go through the plugin, which wires them into
Vite and the generated tsconfig together:

```ts
kit({ alias: { "@/content": "src/content" } });
```

## Server Files (Phase 2)

⚠️ This is a WIP DO NOT IMPLEMENT

### *.server.ts files

These will be build like SvelteKit load functions. They will follow the same convention allowing users to retrieve data on their pages or layouts from `data`.

```ts
export default function Page({ data }) {
	data; // object of data the server returns
}
```
