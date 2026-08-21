---
title: Popover
description: A floating panel anchored to whatever opened it.
section: Components
---

<div data-demo="popover" data-demo-description="An “Open popover” button revealing a small form panel: a Dimensions heading, four labeled inputs (width, max. width, height, max. height), and a Done close button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/popover
```

jsrepo pulls `button` along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/popover.ts`. It imports `button` from the same directory, so install that too.

<div data-source="popover"></div>

<div data-tabs-end></div>

## Usage

An 18rem panel that fades and scales in from the side it opens on, with the transform origin following the side the primitive actually chose after flipping. Unlike a [dropdown menu](/ui/dropdown-menu), the content is ordinary interactive markup — forms, inputs, anything.

`PopoverTrigger` and `PopoverClose` both render through the button styles, defaulting to `default` and to a small `ghost` respectively.

```ts
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/lib/components/ui/popover";

Popover(
	PopoverTrigger({ variant: "outline" }, "Open popover"),
	PopoverContent(
		H4({ class: "font-medium" }, "Dimensions"),
		Input({ placeholder: "Width" }),
		PopoverClose("Done"),
	),
);
```

## Several triggers, one popover

<div data-demo="popover-triggers" data-demo-description="One popover with three triggers (Left, Center, Right); the panel opens anchored to whichever trigger was clicked."></div>

Put more than one `PopoverTrigger` in a popover and the panel anchors to whichever was clicked. Useful for a row of cells that all open the same editor.

## Nesting

<div data-demo="popover-nested" data-demo-description="An outer popover containing an “Open nested” trigger that opens a second popover to the side of the first."></div>

A popover opened from inside another stays open with its parent, and closes with it. The primitive tracks the depth, so the inner panel anchors to its own trigger rather than to the outer one.

## Placement

`side`, `align`, and `offset` live on the content, and the styled defaults are `bottom` / `start` / `5`. The primitive flips the panel when it would overflow the viewport, and writes the side it settled on to `data-side` — which is what the enter transition reads, so the panel always animates out of its anchor.

## API Reference

Every prop the styling does not consume is forwarded to the [Popover primitive](/primitives/docs/popover), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-popover"></div>
