---
title: Tooltip
description: A short label revealed by hovering or focusing a control.
section: Components
---

<div data-demo="tooltip" data-demo-description="Two buttons side by side; resting the pointer on one reveals a small “Add to library” bubble above it, and moving to the second opens its bubble with no delay."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/tooltip
```

jsrepo pulls `button` along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/tooltip.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too.

<div data-source="tooltip"></div>

<div data-tabs-end></div>

## Usage

A small inverted bubble above the trigger. Tooltips label — they do not hold content, and nothing inside one should be interactive; for that, use a [popover](/ui/popover).

`TooltipTrigger` renders through the button styles, so the thing being labelled is usually the trigger itself.

```ts
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/lib/components/ui/tooltip";

TooltipProvider(
	Tooltip(TooltipTrigger({ variant: "outline" }, "Hover me"), TooltipContent("Add to library")),
);
```

## The provider

`TooltipProvider` is what makes a group of tooltips feel like one: after the first opens, moving to a neighbour opens its tooltip immediately instead of waiting out the delay again. Wrap a toolbar — or the whole app — in one, and set `delayDuration` and `skipDelayDuration` there.

## Placement

`side`, `align`, and `offset` are on the content, defaulting to `top` / `center` / `6`. The bubble flips when it would leave the viewport and animates out of whichever side it settled on.

## API Reference

Every prop the styling does not consume is forwarded to the [Tooltip primitive](/primitives/docs/tooltip), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-tooltip"></div>
