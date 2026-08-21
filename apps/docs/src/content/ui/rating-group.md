---
title: Rating Group
description: A row of stars for scoring something.
section: Components
---

<div data-demo="rating-group" data-demo-description="A five-star rating with three selected, and “3 out of 5” read out beneath it."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/rating-group
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/rating-group.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="rating-group"></div>

<div data-tabs-end></div>

## Usage

Each item renders a star that fills while it is active — pass children to use a different mark. The items are indexed rather than valued, so a five-star rating is `Array.from({ length: 5 })`.

```ts
import { signal } from "@implementjs/core";
import { RatingGroup, RatingGroupItem } from "@/lib/components/ui/rating-group";

const value = signal(3);

RatingGroup(
	{ value, "aria-label": "Rate this library" },
	...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index })),
);
```

## Read-only

`readonly` on the root shows a score without offering to change it — the cursor stays an arrow and the items stop responding, but the value is still announced:

```ts
RatingGroup({ value: 4, readonly: true, "aria-label": "Average rating" } /* items */);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Rating Group primitive](/primitives/docs/rating-group), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-rating-group"></div>
