---
title: Toast
description: A stack of transient notifications in the corner of the screen.
section: Components
---

<div data-demo="toast" data-demo-description="A row of buttons (Show toast, Success, Error, With action, Promise) that push styled notifications into a stack in the bottom-right corner of the screen; hovering the stack fans it out, and toasts can be swiped away."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/toast
```

jsrepo pulls `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/toast.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="toast"></div>

<div data-tabs-end></div>

## Usage

The whole stack is one component. `Toaster` mounts the provider, the portal, the viewport, and a styled toast per entry — icon by type, title, description, and an action button when the toast carries one. Mount it once near the root of the app and push toasts from anywhere:

```ts
import { createToastManager, Toaster } from "@/lib/components/ui/toast";

export const toast = createToastManager();

// once, near the root
Toaster({ manager: toast });

// anywhere
toast.add({ title: "Saved", description: "Your changes are live.", type: "success" });
```

## The stack

Collapsed, the toasts behind the front one peek out and scale down. Hovering fans them out by their real heights. A toast can be swiped away and keeps travelling in the direction it was thrown, and toasts past the limit wait invisibly for a slot.

All of that is one transform on `Toast` reading a set of CSS variables the primitive maintains, so the states swap the variables rather than fighting over the property.

## Actions

An action button comes from the toast's `data`:

```ts
toast.add({
	title: "Message archived",
	data: { action: { label: "Undo", onClick: restore } },
});
```

That shape is `ToasterToastData` — the ready-made `Toaster`'s own convention, not the primitive's. `data` is free-form, so change the shape and change `Toaster` to match.

## Building your own

`Toaster` is a starting point, not a wall. The parts it assembles — `ToastProvider`, `ToastPortal`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose` — are all exported, so a different layout is a rewrite of one function in a file you already own.

## API Reference

Every prop the styling does not consume is forwarded to the [Toast primitive](/primitives/docs/toast), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-toast"></div>
