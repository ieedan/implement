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
            index.ts      -> /about   (not /marketing/about)
        contact
            index.ts      -> /contact
    index.ts              -> /
```

Here `/about` and `/contact` render inside the marketing layout, while `/` doesn't — even though all three live at the same URL depth.

Two pages may not resolve to the same path through different groups; kit rejects that at scan time.

The marketing layout is currently empty. Add a `Nav` linking `/`, `/about`, and `/contact`, then compare: the home page has no nav, the marketing pages share one.
