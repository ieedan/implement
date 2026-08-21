---
title: Empty
description: The state a list is in before it has anything in it.
section: Components
---

<div data-demo="empty" data-demo-description="A dashed panel with an inbox icon in a tile, a “No projects yet” heading, a line of explanation, and a New project button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/empty
```

It installs `tailwind-variants` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/empty.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="empty"></div>

<div data-tabs-end></div>

## Usage

An empty state that says what the thing is and offers the first step is worth more than a blank panel. That is all this arranges.

```ts
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/lib/components/ui/empty";

Empty(
	EmptyHeader(
		EmptyMedia({ variant: "icon" }, InboxIcon({ "aria-hidden": true })),
		EmptyTitle("No projects yet"),
		EmptyDescription("Projects group your deployments and domains."),
	),
	EmptyContent(Button({ size: "sm" }, "New project")),
);
```

## The border is opt-in

The root sets `border-dashed` but no `border`, so by default it is a spacing container with no outline. Add `border` when the empty state should read as a panel:

```ts
Empty({ class: "border" } /* ... */);
```

## Media

`EmptyMedia` is plain by default and gives a filled, rounded tile under `variant: "icon"` — the difference between an illustration and a glyph.

## API Reference

<div data-api="ui-empty"></div>
