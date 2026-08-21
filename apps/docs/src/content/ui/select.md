---
title: Select
description: A listbox that drops out of a field, for one value or several.
section: Components
---

<div data-demo="select" data-demo-description="A single-select of five fruits (Grapes disabled) with a “Select a fruit” placeholder; the current selection is echoed in text below."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/select
```

jsrepo pulls [`dropdown-menu`](/ui/dropdown-menu) along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/select.ts`. It imports [`dropdown-menu`](/ui/dropdown-menu) from the same directory, so install that too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="select"></div>

<div data-tabs-end></div>

## Usage

`SelectTrigger` is a bordered field with a chevron appended. `SelectContent` matches the trigger's width, caps itself at the height actually available, and hides itself when closed. Items carry a check on the right while selected.

`SelectValue` is where the styled layer does real work: it brings its own renderer, so a single select shows a truncated label and a multiple select shows removable chips.

```ts
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/lib/components/ui/select";

Select(
	{ value: fruit },
	SelectTrigger({ class: "w-56" }, SelectValue({ placeholder: "Select a fruit" })),
	SelectContent(
		SelectItem({ value: "apple" }, "Apple"),
		SelectItem({ value: "grapes", disabled: true }, "Grapes"),
	),
);
```

## Multiple

<div data-demo="select-multiple" data-demo-description="A multiple-select of five pizza toppings; the trigger summarizes the picks and the selected values are echoed below."></div>

`type: "multiple"` turns `value` into a `Signal<string[]>`, and `SelectValue` switches to chips — each with its own remove button that takes the value out without opening the list:

```ts
const toppings = signal<string[]>([]);

Select(
	{ type: "multiple", value: toppings },
	SelectTrigger({ class: "w-72" }, SelectValue({ placeholder: "Pick toppings" })),
	SelectContent(SelectItem({ value: "olives" }, "Olives")),
);
```

## Groups

<div data-demo="select-group" data-demo-description="A fruit select grouped into Citrus, Berries, and Tropical; the current selection is echoed in text below."></div>

`SelectGroup` and `SelectGroupHeading` divide a long list. The heading is styled to match the menu group headings, which is why the select installs `dropdown-menu` alongside it.

## Sizing

Width belongs on the trigger — the content reads it through `--ip-select-anchor-width` and matches, so the list never comes out a different size from the field it dropped from.

## API Reference

Every prop the styling does not consume is forwarded to the [Select primitive](/primitives/docs/select), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-select"></div>
