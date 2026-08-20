---
title: SSR & Prerendering
description: Server-rendered pages in dev, a prerendered static site on build.
section: Guides
order: 11
---

Kit apps are server-rendered. You don't have to do anything to turn this on, it's how kit serves your app.

## In dev

Every page the dev server sends is rendered on the server first, so content paints before any JavaScript loads. When the client bundle arrives, `App.render` swaps the server markup for its own mount and the app takes over.

This is worth knowing about because it means your route modules run in Node during dev. If a page touches `window` or `document` at module scope it will break the server render. Do your DOM work inside components (they only mount in the browser during dev) or behind lifecycle hooks.

## On build

`vite build` produces a static site. After the client bundle is written, kit renders your routes to HTML and writes one `index.html` per route into `dist/`, so any static host can serve the app with real content in every page.

The set of routes to prerender comes from three places:

1. **Static routes.** Every page without params is known from the file tree, so `/`, `/docs`, and friends are always included.
2. **The crawl.** Kit follows internal links from `/` through server renders, so every page a reader can reach through your app's own links gets prerendered, including dynamic ones.
3. **Your entries.** Dynamic `[param]` pages nothing links to won't be found by the crawl, so you list them yourself:

```ts
// vite.config.ts
export default defineConfig({
	plugins: [
		kit({
			prerender: {
				entries: () => posts.map((post) => `/blog/${post.slug}`),
			},
		}),
	],
});
```

`entries` is a list of paths, or a function returning one (async is fine, load them from wherever your content lives).

## The 404 page

If you have a root [`error.ts`](/kit/routing#the-error-page), the build also renders it into a `404.html`. Most static hosts serve that file for unknown URLs automatically, so your not-found page works even for routes that were never prerendered.

## Opting out

If you're deploying somewhere that doesn't want prerendered HTML, turn it off:

```ts
kit({ prerender: false });
```

You still get the SSR dev server, the build just stops at the client bundle. You'll need to serve it with an SPA fallback so deep links resolve to `index.html`.
