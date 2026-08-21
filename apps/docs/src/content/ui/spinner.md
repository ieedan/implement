---
title: Spinner
description: A turning ring for work in flight.
section: Components
---

<div data-demo="spinner" data-demo-description="Three spinners: the default size, a larger muted one, and one inside a disabled Saving button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/spinner
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/spinner.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="spinner"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Spinner } from "@/lib/components/ui/spinner";

Spinner({ "aria-label": "Loading projects" });
```

It carries `role="status"` and a default label, so a screen reader announces the wait. Pass `aria-label` to say what is being waited on.

## In a button

A button that is working should say so and stop accepting clicks:

```ts
Button({ disabled: true }, Spinner(), "Saving");
```

The button's base styles already size and space an icon inside it, so the spinner needs no classes of its own here.

## Determinate work

A spinner says _something is happening_. When you know how far along it is, say that instead — use [progress](/ui/progress).

## Reduced motion

The spin stops under `prefers-reduced-motion`, leaving a static ring.

## API Reference

<div data-api="ui-spinner"></div>
