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

## Your task

1. In `src/routes/blog/[slug]/index.ts`, replace the hardcoded `"Some post"` heading with `params.slug`.

You're done when `/blog/hello-world` and `/blog/routing-deep-dive` each show their own slug as the heading. Then try typing any other `/blog/...` path into the URL bar — the same page serves it.
