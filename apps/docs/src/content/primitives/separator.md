---
title: Separator
description: Visually or semantically divide content, horizontally or vertically.
section: Components
---

<div data-demo="separator"></div>

A separator is a line between things. `Separator` renders a `Div` you give a size and color to — the primitive only handles orientation and accessibility.

```ts
import { Separator } from "@implementjs/primitives";

Separator({ class: "h-px w-full bg-border" });
```

It takes a props object like the [element factories](/docs/elements), and extra props are forwarded onto the underlying `Div`.

## Orientation

`orientation` defaults to `"horizontal"`. Pass `"vertical"` for dividers in a row, and give the element a height:

```ts
Div(
	{ class: "flex h-5 items-center gap-4" },
	Span("Docs"),
	Separator({ orientation: "vertical", class: "h-full w-px bg-border" }),
	Span("Tutorial"),
);
```

## Decorative or semantic

By default the separator is semantic: it renders `role="separator"` (plus `aria-orientation="vertical"` when vertical) so assistive technology announces the division.

Most dividers are purely visual. Pass `decorative` to render `role="none"` with `aria-hidden`, removing it from the accessibility tree:

```ts
Separator({ decorative: true, class: "h-px w-full bg-border" });
```

## Styling

The primitive is invisible until you style it — it has no default size or color. It sets `data-separator-root` and `data-orientation` so one class list can cover both directions:

```ts
Separator({
	orientation,
	class:
		"bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
});
```

## API Reference

<div data-api="separator"></div>
