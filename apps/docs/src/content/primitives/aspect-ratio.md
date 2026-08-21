---
title: Aspect Ratio
description: Constrain content to a width and height ratio.
section: Components
---

<div data-demo="aspect-ratio"></div>

`AspectRatio` holds its content to a ratio of width to height — a video frame, an image placeholder, a map embed. Give the parent a width and the height follows.

```ts
import { AspectRatio } from "@implementjs/primitives";

AspectRatio({ ratio: 16 / 9 }, Img({ src: "...", alt: "...", class: "size-full object-cover" }));
```

It accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div`.

## Ratio

`ratio` is width divided by height and defaults to `1` (a square). Pass a number to seed it, or a [signal](/docs/signals) to control it from outside:

```ts
AspectRatio({ ratio: 16 / 9 }, Video());
AspectRatio({ ratio: 4 / 3 }, Screenshot());
AspectRatio({ ratio: 1 }, Album());
```

## How it renders

The primitive renders two elements: a sized wrapper that reserves the ratio with padding, and inside it the root `Div` your props and children land on, stretched to fill. Content should usually fill the root — `size-full object-cover` on an image, `size-full` on an iframe.

There is no aria here; an aspect ratio is purely layout. Accessibility comes from the content you put inside, like the image `alt` text.

## Styling

Style the root through `class` like any element; it sets `data-aspect-ratio-root`. Rounded corners want `overflow-hidden` so the content clips to them:

```ts
AspectRatio(
	{ ratio: 16 / 9, class: "overflow-hidden rounded-lg bg-muted" },
	Img({ src: "...", alt: "...", class: "size-full object-cover" }),
);
```

## API Reference

<div data-api="aspect-ratio"></div>
