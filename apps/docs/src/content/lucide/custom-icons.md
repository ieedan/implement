---
title: Custom Icons
description: Build your own icons in the same shape as the Lucide set.
section: Guides
order: 11
---

The package exports the factory it uses internally, so an icon of your own composes exactly like a shipped one.

## createLucideIcon

`createLucideIcon(name, body)` wraps a glyph body in the standard Lucide root attributes — a `24×24` view box, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins — and returns an icon component:

```ts
import { createLucideIcon, type IconComponent } from "@implementjs/lucide";

const SparkleIcon: IconComponent = createLucideIcon(
	"sparkle",
	`<path d="M9.9 3.6a1.5 1.5 0 0 1 2.8 0l1.6 4.1 4.1 1.6a1.5 1.5 0 0 1 0 2.8l-4.1 1.6-1.6 4.1a1.5 1.5 0 0 1-2.8 0l-1.6-4.1-4.1-1.6a1.5 1.5 0 0 1 0-2.8l4.1-1.6z"/>`,
);

SparkleIcon({ class: "size-4" });
```

The `name` becomes the `lucide lucide-<name>` classes on the root, so your icon gets the same styling hooks as the rest of the set. The markup is parsed once and cloned per mount, like every other icon.

This is the right tool when your glyph follows Lucide's conventions: a single-color stroked path drawn on a `24×24` grid. Lucide's [icon design guide](https://lucide.dev/guide/design/icon-design-guide) covers what makes a glyph fit in.

## Anything else

For art that doesn't fit the Lucide mold — filled shapes, multiple colors, a different view box — skip the factory and use the core [`Svg` helper](/docs/svg) directly with your own complete markup:

```ts
import { Svg } from "@implementjs/core";

const logo = `<svg viewBox="0 0 32 32" fill="currentColor"><path d="…"/></svg>`;

Svg(logo, { class: "size-8", "aria-hidden": true });
```
