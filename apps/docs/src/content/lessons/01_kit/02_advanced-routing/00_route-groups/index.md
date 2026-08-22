---
title: Route groups
description: (group) directories share a layout without adding a URL segment.
section: Advanced routing
focus: src/routes/(marketing)/layout.ts
---

Sometimes sibling pages should share a layout the URL never shows. A directory wrapped in parentheses is a _route group_ — it scopes a layout without contributing a URL segment:

```
src/routes
    (marketing)
        layout.ts         wraps everything in the group
        about
            page.ts       -> /about   (not /marketing/about)
        contact
            page.ts       -> /contact
    page.ts               -> /
```

Here `/about` and `/contact` render inside the marketing layout, while `/` doesn't — even though all three live at the same URL depth.

Two pages may not resolve to the same path through different groups; kit rejects that at scan time.

## Your task

1. In `src/routes/(marketing)/layout.ts`, add a `Nav` with links to `/`, `/about`, and `/contact` above `children`.

You're done when `/about` and `/contact` share the nav while `/` has none — the group scoped the layout without ever appearing in the URL.
