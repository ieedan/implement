---
title: Media Queries
description: A CSS media query as a readable, so a layout can branch on the viewport the way it branches on any other signal.
section: The document
order: 19.5
---

`mediaQuery` turns a CSS media query into a `Readable<boolean>`. It is true while the query matches, and it updates when that changes — so the viewport is just another signal.

```ts
import { If, mediaQuery, Span } from "@implementjs/core";

const isMobile = mediaQuery("(max-width: 767px)");

If(isMobile).Then(Span("phone")).Else(Span("desktop"));
```

Anywhere a readable goes, this goes: [`If`](/docs/if), [`Switch`](/docs/switch), a [derived](/docs/derived), a [bound prop](/docs/bindings).

```ts
const dark = mediaQuery("(prefers-color-scheme: dark)");
const reduced = mediaQuery("(prefers-reduced-motion: reduce)");
const wide = mediaQuery("(min-width: 1280px)");

Div({ class: derived([wide], (wide) => (wide ? "grid-cols-3" : "grid-cols-1")) });
```

## It listens only while listened to

The `matchMedia` listener is attached when something subscribes and removed when the last subscriber leaves — the same lifetime rule [`derived`](/docs/derived) follows. So one declared at module scope and imported in two places costs one listener, and a tree that unmounts leaves none behind.

```ts
// module scope is fine: nothing is attached until something reads it reactively
export const isMobile = mediaQuery("(max-width: 767px)");
```

Reading it with `get()` outside a subscription asks `matchMedia` directly and attaches nothing.

## The server, and hydration

There is no viewport on the server, so `mediaQuery` reports `fallback` there — `false` unless you pass one:

```ts
const isDesktop = mediaQuery("(min-width: 768px)", { fallback: true });
```

It keeps reporting the fallback through [hydration](/docs/vite#hydration), which is the part worth knowing. The markup being adopted was rendered against the fallback, and a client render that disagreed would be thrown out and done again — the [mismatch](/docs/vite#hydration) warning you would otherwise get for reading `matchMedia` during a render. The real answer arrives immediately after the pass, as an ordinary update.

That means the fallback is a choice about which layout is worth prerendering, not just a placeholder. Pick the one most readers will see first.

```ts
// the desktop tree is the one worth having in the HTML
const isMobile = mediaQuery("(max-width: 767px)");
```

A browser with no `matchMedia` at all reports the fallback forever, and never attaches anything.
