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

## Server Files (Phase 2)

⚠️ This is a WIP DO NOT IMPLEMENT

### *.server.ts files

These will be build like SvelteKit load functions. They will follow the same convention allowing users to retrieve data on their pages or layouts from `data`.

```ts
export default function Page({ data }) {
	data; // object of data the server returns
}
```
