---
title: SVG
description: Render icons and other SVG from trusted markup, with typed reactive props on the root element.
section: The document
order: 17
---

`Svg(source, props)` builds an `<svg>` element from a markup string. Think of the string as the template and the props as the instance:

```ts
import { Svg } from "@implementjs/core";

const icons = {
	check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>`,
};

Svg(icons.check, { class: "size-4", "aria-hidden": true });
```

## Template caching

Each unique source string is parsed **once** and cached forever, so every mount is a cheap clone. That makes it ideal for a fixed set of icon glyphs, and it's also the reason not to feed it unbounded generated markup, which would grow the cache without limit.

An icon component ends up being a one-liner:

```ts
function Icon(name: keyof typeof icons, cls = "size-4") {
	return Svg(icons[name], { class: cls });
}
```

## Props

Props are applied to the root `<svg>` **as attributes** after cloning, so they override attributes baked into the source string. Keys are the literal SVG attribute names (`viewBox`, `stroke-width`), plus `class`, `style`, event handlers, `aria-*`/`data-*`, and `this`. All of them are bindable:

```ts
Svg(icons.activity, {
	class: ["icon", { spinning: busy }],
	stroke: color, // Readable<string> — updates in place
	"stroke-width": weight,
	onClick: toggle,
});
```

Content _inside_ the root stays as authored in the source string. Props only touch the root element.

## Reactive sources

The source itself can be a `Readable<string>`. A new value swaps the whole element in place (props are re-applied to the new root, and a `this` ref is re-written):

```ts
const glyph = derived([status], (s) => (s === "done" ? icons.check : icons.circle));

Svg(glyph, { class: "size-4" });
```

Reactive props update attributes without any re-parsing. Only a source change clones a new element.

## Trust

Like [`Html`](/docs/html), the markup is parsed without sanitization, so sources must be trusted. A string whose root is not an `<svg>` element renders nothing (with a console warning).

Everything so far renders into the body. Next up is the other half of the page, the [document head](/docs/head).
