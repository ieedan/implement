---
title: Link Preview
description: A card about a link, revealed by resting the pointer on it.
section: Components
---

<div data-demo="link-preview" data-demo-description="A sentence with the link “@ieedan” in it; resting the pointer on the link reveals a card with an avatar, the handle, a one-line bio, and a joined date."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/link-preview
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/link-preview.ts`.

<div data-source="link-preview"></div>

<div data-tabs-end></div>

## Usage

Pointer-only by design: a link preview is an enrichment, so it never opens on focus or on touch, and nothing inside it is reachable by keyboard that is not reachable another way. Put content in it, not controls.

The trigger is styled as an underlined link. The card is a 20rem popover panel that opens above the link by default.

```ts
import {
	LinkPreview,
	LinkPreviewContent,
	LinkPreviewTrigger,
} from "@/lib/components/ui/link-preview";

LinkPreview(
	LinkPreviewTrigger({ href: "https://github.com/ieedan" }, "@ieedan"),
	LinkPreviewContent(
		Div({ class: "flex gap-3" }, Avatar(AvatarFallback("AB")), Span("Aidan Bleser")),
	),
);
```

## Timing and placement

`openDelay` and `closeDelay` are on the root; `side`, `align`, and `offset` on the content. The styled content defaults to `top` / `center` / `8` — a card that sits above the sentence rather than covering the words after it.

## API Reference

Every prop the styling does not consume is forwarded to the [Link Preview primitive](/primitives/docs/link-preview), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-link-preview"></div>
