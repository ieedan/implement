---
title: Button
description: The button, and the variant table half the registry borrows.
section: Components
---

<div data-demo="button" data-demo-description="A row of buttons in every variant and a few sizes: default, secondary, outline, ghost, destructive, link, one with an icon, an icon-only button, and a disabled one."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/button
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/button.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="button"></div>

<div data-tabs-end></div>

## Usage

`buttonVariants` is the part that travels. A dialog trigger, a popover close, the calendar's arrows, a toast action — none of them are `Button`, but all of them render through this table, which is why one edit here restyles the whole registry.

```ts
import { Button, buttonVariants } from "@/lib/components/ui/button";

Button({ variant: "outline", size: "sm" }, "Save");

// the same styles on something that is not a button
A({ href: "/docs", class: buttonVariants({ variant: "link" }) }, "Read the docs");
```

## Icons

An icon in a button is sized and made non-interactive by the base styles, so it needs no classes of its own. Give an icon-only button an `aria-label` — there is no text to name it:

```ts
Button({ size: "icon", "aria-label": "Add" }, PlusIcon({ "aria-hidden": true }));
```

`has-[>svg]` trims the horizontal padding when a button holds both an icon and a label, so the pair stays optically centered.

## Variants elsewhere

`ButtonVariant` and `ButtonSize` are exported as types. Components that put a button somewhere accept them by those names — `DialogTrigger({ variant: "destructive" })` reaches the same table.

## API Reference

<div data-api="ui-button"></div>
