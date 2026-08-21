---
title: Aspect Ratio
description: Hold a child at a fixed width-to-height ratio.
section: Components
---

<div data-demo="aspect-ratio" data-demo-description="A 16-by-9 photo in a rounded, clipped frame that keeps its ratio as the container narrows."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/aspect-ratio
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/aspect-ratio.ts`.

<div data-source="aspect-ratio"></div>

<div data-tabs-end></div>

## Usage

The thinnest component here — the primitive already does the work, and the styled file only adds a `data-slot`. It is in the registry so that `class` and the import path match everything else.

Give the ratio as a number, and put the clipping and rounding on the same element.

```ts
import { AspectRatio } from "@/lib/components/ui/aspect-ratio";

AspectRatio(
	{ ratio: 16 / 9, class: "overflow-hidden rounded-lg bg-muted" },
	Img({ src: photo, alt: "", class: "size-full object-cover" }),
);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Aspect Ratio primitive](/primitives/docs/aspect-ratio), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-aspect-ratio"></div>
