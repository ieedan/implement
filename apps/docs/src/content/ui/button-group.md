---
title: Button Group
description: Buttons joined into one control.
section: Components
---

<div data-demo="button-group" data-demo-description="Three groups: a formatting toolbar of icon buttons, a row of merge options split by a separator, and a URL field with a prefix label and an Add button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/button-group
```

jsrepo pulls [`separator`](/ui/separator) along with it, and installs `tailwind-variants`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/button-group.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`separator`](/ui/separator) from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="button-group"></div>

<div data-tabs-end></div>

## Usage

```ts
import { ButtonGroup } from "@/lib/components/ui/button-group";

ButtonGroup(
	Button({ variant: "outline", size: "sm" }, "Merge"),
	Button({ variant: "outline", size: "sm" }, "Squash"),
	Button({ variant: "outline", size: "sm" }, "Rebase"),
);
```

The group squares off the inner corners and drops the doubled borders between children, so a row of outline buttons reads as one segmented thing rather than as three.

## It joins by position, not by type

The rules are written against `:first-child` and `:last-child`, so anything in the row joins on the same terms. A [select](/ui/select) trigger, an [input](/ui/input), and a `ButtonGroupText` prefix all fit:

```ts
ButtonGroup(
	ButtonGroupText("https://"),
	Input({ placeholder: "example.com", "aria-label": "Site" }),
	Button({ variant: "outline" }, "Add"),
);
```

## Separators

Because the group removes the borders between children, a visible divider has to go back in on purpose:

```ts
ButtonGroup(Button("Merge"), ButtonGroupSeparator(), Button("Squash"));
```

## Vertical

`orientation: "vertical"` stacks the row and joins the top and bottom edges instead of the left and right.

## API Reference

<div data-api="ui-button-group"></div>
