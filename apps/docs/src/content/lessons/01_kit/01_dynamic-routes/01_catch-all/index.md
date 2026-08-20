---
title: Catch-all routes
description: "[...rest] matches one or more remaining segments."
section: Dynamic routes
focus: src/routes/docs/[...path]/index.ts
---

A `[param]` directory matches exactly one segment. To match one _or more_ trailing segments — a docs tree, a file browser — prefix the name with `...`:

```
src/routes
    docs
        [...path]
            index.ts      -> /docs/a, /docs/a/b, /docs/a/b/c, ...
```

The matched segments surface as a single readable, joined with `/` — visiting `/docs/guides/routing` gives `params.path` the value `"guides/routing"`.

A catch-all must be the last thing in its path: nothing can route below it. And when routes compete for the same URL, static segments beat `[param]`s, which beat catch-alls — so you can add a `docs/index.ts` later without the catch-all swallowing it.

The docs page ignores the requested path. Render `params.path` so you can tell which document you're on, then try some deep paths in the URL bar.
