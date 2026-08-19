---
title: Introduction
description: The full Lucide icon set as implement components.
section: Start Here
order: 1
---

`@implementjs/lucide` packages every icon from [Lucide](https://lucide.dev) as an implement component. Call one like any other element factory and you get a mountable `<svg>`:

```ts
import { Button } from "@implementjs/core";
import { HouseIcon } from "@implementjs/lucide";

Button({ onClick: goHome }, HouseIcon({ class: "size-4" }), "Home");
```

Add it next to core as a workspace dependency:

```jsonc
// package.json
{
	"dependencies": {
		"@implementjs/core": "workspace:*",
		"@implementjs/lucide": "workspace:*",
	},
}
```

Browse the full set on [lucide.dev/icons](https://lucide.dev/icons); every icon there ships here under its PascalCase name.

## Only what you import

The package exports over two thousand icons, but each icon lives in its own module and the package is marked side-effect free, so bundlers keep only the ones your app imports. Importing `HouseIcon` costs you one icon, not the whole set.

Each icon's markup is parsed once and cloned per mount (the same template caching as the core [`Svg` helper](/docs/svg) it is built on), so mounting the same icon many times stays cheap.

## Where to next

- [Usage](/lucide/usage) covers naming, props, sizing, and color.
- [Custom icons](/lucide/custom-icons) shows how to build your own icons in the same shape.
