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

The home page already links to `/about`, but that page is unfinished. Give it a heading that says "About" and a paragraph about yourself, then click between the two pages.
