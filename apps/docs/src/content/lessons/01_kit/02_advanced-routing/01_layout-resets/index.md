---
title: Layout resets
description: An @ in a route filename opts out of inherited layouts.
section: Advanced routing
focus: src/routes/(app)/zen/index@.ts
---

Occasionally a page shouldn't inherit the layouts above it — a login screen, a full-bleed presentation view. An `@` in the filename resets which layouts wrap it. The name after the `@` is the ancestor directory segment whose layout chain to keep; a bare `@` resets all the way back to the root layout:

```
index@.ts            rendered with only the root layout
index@(authed).ts    keeps layouts up to and including (authed)
layout@.ts           this layout inherits only the root layout
```

Resets never change the URL — only which layouts wrap the page.

In this app every page lives in the `(app)` group, whose layout draws the header nav. The zen page is declared as `index@.ts`, so it skips the group's layout and renders with only the minimal root layout:

```
src/routes
    layout.ts                root layout
    (app)
        layout.ts            header nav
        index.ts             -> /
        about
            index.ts         -> /about
        zen
            index@.ts        -> /zen, header skipped
```

Give the zen page some calm content, then flip between `/about` (header) and `/zen` (no header).
