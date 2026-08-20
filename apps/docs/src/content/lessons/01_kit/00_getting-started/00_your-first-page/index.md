---
title: Your first page
description: File-based routing with implement kit.
section: Getting started
---

Welcome to the kit tutorial!

`@implementjs/kit` is a full stack framework for building implement apps on top of vite. You get file-based routing, layouts, server rendering, and prerendering without wiring any of it up yourself.

Routes live under `src/routes` — you can see the project's files in the tree on the left of the editor. A directory maps to a URL segment, and an `index.ts` file inside it is the page for that URL. The file you're looking at, `src/routes/index.ts`, is the page for `/`.

A page default-exports a component:

```ts
export default function Page() {
	return H1("Hello!");
}
```

## Your task

1. In `src/routes/index.ts`, change the heading text to say `Hello, kit!`.

You're done when the preview below the editor shows **Hello, kit!** — it updates as you type.
