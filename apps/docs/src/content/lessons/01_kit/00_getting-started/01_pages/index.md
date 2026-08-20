---
title: Pages
description: Every directory under src/routes is a URL segment.
section: Getting started
focus: src/routes/index.ts
---

Every directory under `src/routes` adds a URL segment, and an `index.ts` inside it becomes the page for that path:

```
src/routes
    index.ts          -> /
    about
        index.ts      -> /about
```

As soon as the app has more than one route, the preview grows a URL bar. Navigate by typing a path and pressing enter, or by clicking links — links are just regular `A` elements pointing at a path:

```ts
A({ href: "/about" }, "About");
```

## Your task

The home page links to `/about`, but that page doesn't exist yet — click the link and you'll get the 404.

1. In the file tree, create the file `src/routes/about/index.ts` — the + icons at the top (or on any folder row) create files and folders.
2. In your new file, default-export a page that returns an `H1` saying `About` and a `P` with a sentence about yourself.

You're done when clicking the **About** link shows your heading and paragraph instead of the 404.
