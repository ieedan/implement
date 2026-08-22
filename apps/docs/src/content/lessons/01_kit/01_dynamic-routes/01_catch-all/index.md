---
title: Catch-all routes
description: "[...rest] matches one or more remaining segments."
section: Dynamic routes
focus: src/routes/page.ts
---

A `[param]` directory matches exactly one segment. To match one _or more_ trailing segments — a docs tree, a file browser — prefix the name with `...`:

```
src/routes
    docs
        [...path]
            page.ts       -> /docs/a, /docs/a/b, /docs/a/b/c, ...
```

The matched segments surface as a single readable, joined with `/` — visiting `/docs/guides/routing` gives `params.path` the value `"guides/routing"`.

A catch-all must be the last thing in its path: nothing can route below it. And when routes compete for the same URL, static segments beat `[param]`s, which beat catch-alls — so you can add a `docs/page.ts` later without the catch-all swallowing it.

## Your task

The home page links into `/docs/...`, but the docs tree doesn't exist yet.

1. Create the file `src/routes/docs/[...path]/page.ts` in the file tree — one `[...path]` directory catches every depth.
2. Default-export a page that renders `params.path` so it shows which document was requested.

You're done when `/docs/guides/routing` shows `guides/routing` on the page. Try a few deeper paths in the URL bar — one page catches them all.
