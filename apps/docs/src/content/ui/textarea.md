---
title: Textarea
description: A multi-line text field.
section: Components
---

<div data-demo="textarea" data-demo-description="A labelled message textarea that grows as you type, capped at a maximum height."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/textarea
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/textarea.ts`.

<div data-source="textarea"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Textarea } from "@/lib/components/ui/textarea";

Textarea({ id: "message", placeholder: "Tell us what happened…" });
```

Styled to match [Input](/ui/input), down to the focus ring and the invalid state.

## It grows with the content

`field-sizing-content` makes the textarea size itself to what is typed, where the browser supports it. The base class sets a minimum of `min-h-16`; add a `max-h-*` to stop it running away:

```ts
Textarea({ id: "message", class: "max-h-40" });
```

Where `field-sizing` is not supported the textarea simply keeps its minimum height and scrolls, which is the old behavior — nothing breaks.

## API Reference

<div data-api="ui-textarea"></div>
