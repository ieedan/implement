---
title: Alert
description: A standing message about the page.
section: Components
---

<div data-demo="alert" data-demo-description="Three alerts: a default one with a terminal icon, a destructive one about a declined card, and a title-only alert with no icon."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/alert
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/alert.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="alert"></div>

<div data-tabs-end></div>

## Usage

An alert stays until the situation changes. For something that passes, use a [toast](/ui/toast); for something that must be answered, an [alert dialog](/ui/alert-dialog).

```ts
import { Alert, AlertDescription, AlertTitle } from "@/lib/components/ui/alert";

Alert(
	TerminalIcon({ "aria-hidden": true }),
	AlertTitle("Heads up"),
	AlertDescription("You can add components with the jsrepo CLI."),
);
```

## The icon column

The root is a grid whose first column only appears when an icon is actually there (`has-[>svg]`), so a text-only alert has no empty gutter to explain. Put the icon first, before the title.

## Destructive

```ts
Alert({ variant: "destructive" }, CircleAlertIcon(), AlertTitle("Payment failed"));
```

The variant recolors the title and the description together — the description is reached through `*:data-[slot=alert-description]`, so it follows without being told.

## API Reference

<div data-api="ui-alert"></div>
