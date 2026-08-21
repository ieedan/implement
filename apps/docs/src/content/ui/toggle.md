---
title: Toggle
description: A button that stays pressed.
section: Components
---

<div data-demo="toggle" data-demo-description="Three formatting toggles — bold pressed, italic unpressed, underline disabled."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/toggle
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/toggle.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="toggle"></div>

<div data-tabs-end></div>

## Usage

A two-state button: bold on or off, a filter applied or not. `variant` picks transparent or outlined, `size` the scale — both are also written out as `data-variant` and `data-size` for styling from outside.

For a set of them that share state, use a [toggle group](/ui/toggle-group).

```ts
import { signal } from "@implementjs/core";
import { Toggle } from "@/lib/components/ui/toggle";

const bold = signal(false);

Toggle({ pressed: bold, "aria-label": "Toggle bold" }, BoldIcon({ "aria-hidden": true }));
```

## Labelling an icon toggle

A toggle with only an icon in it has no accessible name, so give it one — and hide the icon from the accessibility tree, since it is not the label.

## API Reference

Every prop the styling does not consume is forwarded to the [Toggle primitive](/primitives/docs/toggle), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-toggle"></div>
