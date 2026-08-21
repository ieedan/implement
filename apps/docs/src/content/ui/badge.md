---
title: Badge
description: A small status marker.
section: Components
---

<div data-demo="badge" data-demo-description="Badges in each variant — default, secondary, outline, destructive — plus one with a check icon and a round count badge."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/badge
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/badge.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="badge"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Badge } from "@/lib/components/ui/badge";

Badge("Default");
Badge({ variant: "outline" }, "Draft");
Badge({ variant: "destructive" }, "Failed");
```

## As a link

`Badge` renders a `Span`. For a badge that navigates, put `badgeVariants()` on an `A` instead:

```ts
import { badgeVariants } from "@/lib/components/ui/badge";

A({ href: "/releases", class: badgeVariants({ variant: "outline" }) }, "v2.1.0");
```

The hover rules are written against `[a&]`, so they only switch on once the badge really is a link — a `Span` badge does not pretend to be clickable.

## Counts

A round count is a class, not a variant:

```ts
Badge({ variant: "secondary", class: "rounded-full px-1.5 tabular-nums" }, "8");
```

`tabular-nums` keeps the badge from resizing as the number ticks.

## API Reference

<div data-api="ui-badge"></div>
