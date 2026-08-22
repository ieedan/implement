---
title: Layout resets
description: An @ in a route filename opts out of inherited layouts.
section: Advanced routing
focus: src/routes/(app)/zen/page@.ts
---

Occasionally a page shouldn't inherit the layouts above it — a login screen, a full-bleed presentation view. An `@` in the filename resets which layouts wrap it. The name after the `@` is the ancestor directory segment whose layout chain to keep; a bare `@` resets all the way back to the root layout:

```
page@.ts             rendered with only the root layout
page@(authed).ts     keeps layouts up to and including (authed)
layout@.ts           this layout inherits only the root layout
```

Resets never change the URL — only which layouts wrap the page.

In this app every page lives in the `(app)` group, whose layout draws the header nav. The zen page is declared as `page@.ts`, so it skips the group's layout and renders with only the minimal root layout:

```
src/routes
    layout.ts                root layout
    (app)
        layout.ts            header nav
        page.ts              -> /
        about
            page.ts          -> /about
        zen
            page@.ts         -> /zen, header skipped
```

## Your task

1. In `src/routes/(app)/zen/page@.ts`, give the zen page some calm content of your own — a heading and a sentence is plenty.

You're done when `/about` renders with the header nav and `/zen` renders without it. The `@` in `page@.ts` is doing that — rename it to plain `page.ts` in your head and imagine the header coming back.
