---
title: Layouts
description: A layout.ts wraps every page beneath it.
section: Getting started
focus: src/routes/layout.ts
---

Most apps share UI across pages — a header, a nav, a footer. Instead of repeating it on every page, a `layout.ts` wraps every page at its level and below.

A layout default-exports a component that receives the current page as `children`:

```ts
export default function Layout({ children }) {
	return Div(Nav(A({ href: "/" }, "home")), Main(children));
}
```

Navigating between pages only swaps `children` — the layout itself stays mounted, so its state (a scrolled sidebar, an open menu) survives navigation.

## Your task

1. In `src/routes/layout.ts`, render a `Nav` containing two `A` links — one to `/` and one to `/about` — above `children`.

You're done when both pages show the same nav, and clicking between them swaps only the content below it — the nav never remounts.
