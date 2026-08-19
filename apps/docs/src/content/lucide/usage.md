---
title: Usage
description: Naming, props, sizing, and color for icon components.
section: Guides
order: 10
---

## Names

Icon names are the PascalCase form of the Lucide name: `arrow-right` becomes `ArrowRight`, `circle-check` becomes `CircleCheck`. Every icon is also exported with an `Icon` suffix, so `ArrowRight` and `ArrowRightIcon` are the same component — use the suffixed form when the plain name reads ambiguously or collides with something else in scope:

```ts
import { ArrowRight, ArrowRightIcon } from "@implementjs/lucide";

ArrowRight({ class: "size-4" });
ArrowRightIcon({ class: "size-4" }); // same component
```

## Props

An icon takes a single optional props object, the same `SvgProps` the core [`Svg` helper](/docs/svg) accepts: `class`, stroke and fill attributes, ARIA and `data-*` attributes, event handlers, and so on. Props are applied to the root `<svg>` after cloning, so they override the attributes baked into the glyph:

```ts
import { LoaderCircleIcon } from "@implementjs/lucide";

LoaderCircleIcon({
	class: ["size-4 animate-spin", spinning],
	"stroke-width": 1.5,
	"aria-hidden": true,
});
```

Every prop is bindable, so signals and derived values update the mounted element in place — no re-parsing, no re-mounting.

One exception to "props override the source": the `lucide lucide-<name>` classes every Lucide icon carries are merged with the `class` (or `className`) you pass, not replaced by it.

## Sizing

Icons default to Lucide's `24×24` box. Override it with `class` or the `width`/`height` props:

```ts
SearchIcon({ class: "size-4" });
SearchIcon({ width: 16, height: 16 });
```

## Color

Glyphs are stroked with `currentColor`, so an icon inherits the text color of wherever you mount it. Style the text color and the icon follows; pass `stroke` when you need to break from it:

```ts
Span({ class: "text-red-500" }, TriangleAlertIcon({ class: "size-4" }), " Something failed");

CircleCheckIcon({ stroke: "var(--color-success)" });
```

## Accessibility

Icons are decorative by default as far as the markup is concerned — nothing is announced unless you say so. Hide purely decorative icons from assistive tech, and label icons that stand alone:

```ts
// decorative, next to a text label
Button({}, TrashIcon({ class: "size-4", "aria-hidden": true }), "Delete");

// the icon is the label
Button({ "aria-label": "Delete" }, TrashIcon({ class: "size-4", "aria-hidden": true }));
```
