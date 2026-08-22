---
title: Tabs
description: Panels behind a strip of triggers, in a segmented or an underlined style.
section: Components
---

<div data-demo="tabs" data-demo-description="An “Account” and “Password” tab strip; the selected tab shows a small form with a field and a save button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/tabs
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/tabs.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="tabs"></div>

<div data-tabs-end></div>

## Usage

Two looks, chosen with `variant` on the list and the trigger. `default` is the segmented control — a filled track the triggers sit in. `underline` is the flatter form for prose, where a filled track would read as a component dropped into the page rather than part of it.

Set the same variant on both: they are styled as a pair.

```ts
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/ui/tabs";

Tabs(
	{ value: "account" },
	TabsList(
		TabsTrigger({ value: "account" }, "Account"),
		TabsTrigger({ value: "password" }, "Password"),
	),
	TabsContent({ value: "account" }, "Make changes to your account here."),
	TabsContent({ value: "password" }, "Change your password here."),
);
```

## The underline variant

```ts
Tabs(
	{ value: "cli" },
	TabsList(
		{ variant: "underline" },
		TabsTrigger({ variant: "underline", value: "cli" }, "CLI"),
		TabsTrigger({ variant: "underline", value: "manual" }, "Manual"),
	),
	TabsContent({ value: "cli" } /* ... */),
);
```

This is the variant the installation tabs on this page use.

## Vertical

`orientation: "vertical"` on the root turns the strip into a column and swaps the arrow keys over. Both variants follow it — the underline moves to the trailing edge.

## About the dark theme

The segmented variant departs from shadcn's dark recipe on purpose. That recipe puts `bg-input/30` on a `bg-muted` track, and in this palette `--input` and `--muted` are the same grey, so the selected tab would vanish. The active trigger lifts off the track with `bg-foreground/10` instead. If you re-theme those two tokens apart, that is the line to revisit.

## API Reference

Every prop the styling does not consume is forwarded to the [Tabs primitive](/primitives/docs/tabs), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-tabs"></div>
