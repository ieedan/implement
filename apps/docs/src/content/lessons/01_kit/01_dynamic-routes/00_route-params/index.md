---
title: Route params
description: "[param] directories bind a URL segment to a value."
section: Dynamic routes
focus: src/routes/blog/[slug]/index.ts
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

The home page links to two posts, but the post page ignores its param. Render `params.slug` in the heading so each post shows its own name. You can also try typing any `/blog/...` path into the URL bar.
