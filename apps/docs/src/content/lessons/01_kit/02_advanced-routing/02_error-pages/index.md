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

This app has two ways to fail: type a path that doesn't exist into the URL bar (a 404), or visit `/broken`, whose page throws on render (a 500). Right now the error page shrugs with the same message for both. Show `error.code` and `error.message` so you can tell them apart.
