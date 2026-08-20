---
title: Error pages
description: A root error.ts renders unmatched paths and render errors.
section: Advanced routing
focus: src/routes/error.ts
---

When no route matches the URL, or a page throws while rendering, kit renders the root `error.ts` instead of the page. It receives the error and the current location:

```ts
export default function ErrorPage({ error, url }) {
	error.code; // 404 for unmatched paths, 500 for render errors
	error.message;
}
```

`error.ts` lives directly in `src/routes` and only there — one error page per app.

## Your task

1. In `src/routes/error.ts`, render `error.code` and `error.message` instead of the generic text.

You're done when the two failure modes look different: typing a nonsense path like `/nope` into the URL bar shows **404** with "Not Found", and visiting `/broken` (its page throws on render) shows **500** with the thrown message.
