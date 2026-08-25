---
"@implementjs/router": patch
---

`navigate` and `href` take params the way `Link` does — under a `params` key, signals included.

`navigate("/issues/:id", { params: { id }, replace: true })` is now the shape, so the object behind a `Link` carries over to the `onSelect: () => navigate(...)` it becomes, unchanged. A `Readable` param is allowed everywhere a param is: `Link` tracks it and rewrites its `href`, while `navigate` and `href` read it at call time, which is what a one-shot navigation and a plain string can do. Both keep accepting params positionally — `navigate(path, params, options)` and `href(path, params)` — so nothing has to move; the positional `navigate` is marked deprecated in its doc comment.
