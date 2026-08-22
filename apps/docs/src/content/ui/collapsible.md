---
title: Collapsible
description: One section of content that opens and closes.
section: Components
---

<div data-demo="collapsible" data-demo-description="A “@ieedan starred 3 packages” header with a chevron toggle: one repo stays visible, expanding reveals two more."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/collapsible
```

jsrepo pulls `button` along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/collapsible.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too.

<div data-source="collapsible"></div>

<div data-tabs-end></div>

## Usage

An [accordion](/ui/accordion) without the group: one trigger, one panel, no shared state. `CollapsibleTrigger` renders through the button styles and defaults to `ghost`, so it reads as a control without a filled background — pass `variant` and `size` to change that.

```ts
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/lib/components/ui/collapsible";

Collapsible(
	CollapsibleTrigger({ size: "icon-sm" }, ChevronsUpDownIcon({ "aria-hidden": true })),
	CollapsibleContent("@implementjs/kit", "@implementjs/primitives"),
);
```

## Animation

The slide comes from the `collapsible-down` / `collapsible-up` keyframes in your stylesheet — the [introduction](/ui) has the block. Without them the panel shows and hides without animating.

`CollapsibleContent` puts your `class` on an inner `Div`, so padding you add does not fight the height animation.

## API Reference

Every prop the styling does not consume is forwarded to the [Collapsible primitive](/primitives/docs/collapsible), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-collapsible"></div>
