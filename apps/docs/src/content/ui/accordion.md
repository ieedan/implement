---
title: Accordion
description: Expand and collapse sections of content, one at a time or several at once.
section: Components
---

<div data-demo="accordion" data-demo-description="A three-item FAQ accordion (type multiple) about implement; clicking a question expands its answer, several can stay open."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/accordion
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/accordion.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="accordion"></div>

<div data-tabs-end></div>

## Usage

`AccordionTrigger` is where most of the styling lives. It wraps itself in an `AccordionHeader`, lays the label out against a chevron, and turns the chevron over while the item is open — so a trigger is just its label.

```ts
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/lib/components/ui/accordion";

Accordion(
	{ type: "multiple" },
	AccordionItem(
		{ value: "what" },
		AccordionTrigger("What is implement?"),
		AccordionContent("A signal-based UI framework with no compiler."),
	),
);
```

## Animation

The open and close slide comes from the `accordion-down` / `accordion-up` keyframes, which the component references but does not define — they belong in your stylesheet, and the [introduction](/ui) has the block to paste. Without them the content still shows and hides correctly; it just snaps.

`AccordionContent` puts your `class` on an inner padded `Div` rather than on the animated element, so padding you add never fights the height animation.

## API Reference

Every prop the styling does not consume is forwarded to the [Accordion primitive](/primitives/docs/accordion), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-accordion"></div>
