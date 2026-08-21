---
title: Command
description: A searchable command palette, filtered and ranked as you type.
section: Components
---

<div data-demo="command" data-demo-description="A command palette with Suggestions and Settings groups; typing filters and re-ranks the items, and the last selection is echoed below."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/command
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/command.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="command"></div>

<div data-tabs-end></div>

## Usage

`Command` is a scored list over a search box: every item is matched against the query, the losers are hidden, and the survivors are re-ordered. The styled layer supplies the popover surface, the search row (icon, border, and a default placeholder), and a list capped at 20rem with its own scrolling.

```ts
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandGroupHeading,
	CommandGroupItems,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/lib/components/ui/command";

Command(
	{ label: "Command palette" },
	CommandInput({ placeholder: "Type a command..." }),
	CommandList(
		CommandEmpty("No results found."),
		CommandGroup(
			CommandGroupHeading("Suggestions"),
			CommandGroupItems(
				CommandItem({ value: "calendar", onSelect: open }, "Calendar"),
				CommandItem({ value: "search", onSelect: open }, "Search"),
			),
		),
	),
);
```

## In a dialog

A palette is usually a modal. Put the command inside a [dialog](/ui/dialog) and drop the dialog's own padding, so the search row sits flush against the top edge:

```ts
Dialog(
	{ open },
	DialogOverlay(),
	DialogContent(
		{ class: "p-0", showCloseButton: false },
		Command({ label: "Command palette" }, CommandInput(), CommandList(/* ... */)),
	),
);
```

## Grid mode

<div data-demo="command-grid" data-demo-description="An emoji picker in grid mode: three groups laid out five columns wide, navigable in two dimensions with the arrow keys."></div>

`columns` lays the items out in a grid and turns the arrow keys two-dimensional — what an emoji or icon picker wants. `CommandGroupItems` is where the grid classes go, since it owns the item row.

## API Reference

Every prop the styling does not consume is forwarded to the [Command primitive](/primitives/docs/command), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-command"></div>
