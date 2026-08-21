---
title: Kbd
description: Keys, for documenting a shortcut.
section: Components
---

<div data-demo="kbd" data-demo-description="Three shortcut lines: ⌘K for search, Ctrl+B for the sidebar, and a G-then-H sequence."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/kbd
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/kbd.ts`.

<div data-source="kbd"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Kbd, KbdGroup } from "@/lib/components/ui/kbd";

KbdGroup(Kbd("⌘"), Kbd("K"));
```

`Kbd` is one key. `KbdGroup` is a chord or a sequence read as one shortcut — it keeps the keys on the same line with an even gap.

## Inside a tooltip

A shortcut is often shown next to what it does, in a [tooltip](/ui/tooltip). The muted grey a key uses on the page has no contrast on a tooltip's inverted panel, so `Kbd` detects that it is inside one and flips its own colors:

```ts
TooltipContent("Toggle the sidebar", KbdGroup(Kbd("⌘"), Kbd("B")));
```

Nothing to pass — the rule keys off `[data-slot=tooltip-content]` on an ancestor.

## Sequences

For a two-step shortcut, put the connecting word between the keys rather than inside one:

```ts
KbdGroup(Kbd("G"), Span({ class: "text-muted-foreground" }, "then"), Kbd("H"));
```

## API Reference

<div data-api="ui-kbd"></div>
