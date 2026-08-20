---
title: Route params
description: "[param] directories bind a URL segment to a value."
section: Dynamic routes
focus: src/routes/index.ts
---

Sometimes one page should serve many URLs — a blog post page for every post, a user page for every user. Wrapping a directory name in square brackets makes that segment a parameter:

```
src/routes
    blog
        [slug]
            index.ts      -> /blog/anything
```

The page receives its params as reactive readables, so you can render them directly or derive from them:

```ts
export default function Page({ params }) {
	return H1(params.slug);
}
```

Because params are readable signals, navigating from `/blog/one` to `/blog/two` doesn't remount the page — the `slug` value just updates in place.

## Your task

The home page links to two posts, but nothing matches `/blog/...` yet — the links 404.

1. Create the file `src/routes/blog/[slug]/index.ts` in the file tree — the `[slug]` folder is named brackets and all.
2. Default-export a page that renders `params.slug` in an `H1`.

You're done when `/blog/hello-world` and `/blog/routing-deep-dive` each show their own slug as the heading. Then try any other `/blog/...` path in the URL bar — the same page serves it.
