---
title: Pages
description: Every directory under src/routes is a URL segment.
section: Getting started
focus: src/routes/about/index.ts
---

Every directory under `src/routes` adds a URL segment, and an `index.ts` inside it becomes the page for that path:

```
src/routes
    index.ts          -> /
    about
        index.ts      -> /about
```

Because this app now has more than one route, the preview has grown a URL bar. Navigate by typing a path and pressing enter, or by clicking links — links are just regular `A` elements pointing at a path:

```ts
A({ href: "/about" }, "About");
```

## Your task

1. In `src/routes/about/index.ts`, make the page return an `H1` that says `About` and a `P` with a sentence about yourself.

You're done when clicking the **About** link on the home page shows your heading and paragraph, and the URL bar reads `/about`.
