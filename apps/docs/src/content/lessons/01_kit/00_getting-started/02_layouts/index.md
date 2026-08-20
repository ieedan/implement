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

This app's root layout currently renders its pages with nothing around them. Add a `Nav` with links to `/` and `/about` above `children`, then click between the pages and notice the nav sticks around.
