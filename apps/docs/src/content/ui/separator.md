---
title: Separator
description: A line between things.
section: Components
---

<div data-demo="separator" data-demo-description="A heading and description divided from a row of links (Docs, Tutorial, REPL) by a horizontal separator, with vertical separators between the links."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/separator
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/separator.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too.

<div data-source="separator"></div>

<div data-tabs-end></div>

## Usage

A 1px line in the border color, running along whichever orientation you pick. `decorative` defaults to `true`, which keeps it out of the accessibility tree — a line drawn for the eye should not be announced. Set it to `false` for a separator that genuinely divides content into sections.

A vertical separator has no height of its own: give it one, or put it in a flex row that stretches.

```ts
import { Separator } from "@/lib/components/ui/separator";

Separator();

Div(
	{ class: "flex h-5 items-center gap-4" },
	Span("Docs"),
	Separator({ orientation: "vertical" }),
	Span("Tutorial"),
);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Separator primitive](/primitives/docs/separator), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-separator"></div>
