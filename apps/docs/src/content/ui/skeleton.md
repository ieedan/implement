---
title: Skeleton
description: A shape standing in for content that has not arrived.
section: Components
---

<div data-demo="skeleton" data-demo-description="An avatar circle beside two lines of placeholder text, pulsing."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/skeleton
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/skeleton.ts`.

<div data-source="skeleton"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Skeleton } from "@/lib/components/ui/skeleton";

Skeleton({ class: "h-4 w-48" });
Skeleton({ class: "size-12 rounded-full" });
```

There are no size props: give it the classes the real content will have, so the swap does not move the layout.

## Matching the real thing

A skeleton is worth having only if it is the same size as what replaces it. Build it from the same classes:

```ts
// the real row
Div({ class: "flex items-center gap-4" }, Avatar({ class: "size-12" }), Span("Aidan Bleser"));

// its placeholder
Div(
	{ class: "flex items-center gap-4" },
	Skeleton({ class: "size-12 rounded-full" }),
	Skeleton({ class: "h-4 w-32" }),
);
```

## Reduced motion

The pulse is turned off under `prefers-reduced-motion` — the shape stays, the animation goes.

## API Reference

<div data-api="ui-skeleton"></div>
