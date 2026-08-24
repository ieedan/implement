---
title: Select
description: Choose one value, or several, from a list of options.
section: Components
---

<div data-demo="select" data-demo-description="A single-select of five fruits (Grapes disabled) with a “Select a fruit” placeholder; the current selection is echoed in text below."></div>

A select is a button that opens a list of options. `Select` is the root, `SelectTrigger` is the control that toggles it, `SelectValue` is the selected label inside the trigger, `SelectContent` is the list, and `SelectItem` is one option. Pass `items` on the root so `SelectValue` always has the right labels; without it, labels come from each option's text.

```ts
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@implementjs/primitives";

const fruits = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
];

Select(
	{ items: fruits },
	SelectTrigger(SelectValue({ placeholder: "Select a fruit" })),
	SelectContent(SelectItem({ value: "apple" }, "Apple"), SelectItem({ value: "banana" }, "Banana")),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props on the trigger, content, and items are forwarded onto the underlying `Button` or `Div`.

## Open state

`Select` owns whether the list is open. Pass a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged):

```ts
const open = signal(false);

Select(
	{ open },
	SelectTrigger(SelectValue({ placeholder: "Select" })),
	SelectContent(SelectItem({ value: "a" }, "A")),
);

Button({ onClick: () => open.set(false) }, "Close");
```

The primitive does not hide the content for you. Style it against `data-state`, the same way [Popover](/primitives/docs/popover) does. The page behind stays scrollable while the list is open; pass `preventScroll: true` to lock it.

## Single or multiple

`type` defaults to `"single"`: choosing an item sets `value` to that item's value. Pass `"multiple"` to toggle items in and out of an array instead.

```ts
const fruit = signal<string | null>(null);

Select(
	{ value: fruit, items: [{ value: "apple", label: "Apple" }] },
	SelectTrigger(SelectValue({ placeholder: "Select a fruit" })),
	SelectContent(SelectItem({ value: "apple" }, "Apple")),
);
```

```ts
const toppings = signal<string[]>([]);

Select(
	{ type: "multiple", value: toppings, items: [{ value: "olives", label: "Olives" }] },
	SelectTrigger(SelectValue({ placeholder: "Select toppings" })),
	SelectContent(SelectItem({ value: "olives" }, "Olives")),
);
```

Every item needs a stable `value`, a string or a number. That is what the root tracks, so it also has to be unique within the select.

A number stays a number on the way back out — an id from a database can go straight in without being stringified and parsed again:

```ts
const fruit = signal<number | null>(null);

Select(
	{ value: fruit, items: [{ value: 1, label: "Apple" }] },
	SelectTrigger(SelectValue({ placeholder: "Select a fruit" })),
	SelectContent(SelectItem({ value: 1 }, "Apple")),
);
```

The DOM only speaks strings, so `data-value` on the option is the number written out. Values are matched by identity, though, so `1` and `"1"` are two different items — pick one shape per select.

<div data-demo="select-multiple" data-demo-description="A multiple-select of five pizza toppings; the trigger summarizes the picks and the selected values are echoed below."></div>

## The selected label

`SelectValue` belongs inside the trigger. The root stores item values; `SelectValue` turns those into labels.

Pass `items` on the root when you can. That list is the source of truth, so the trigger is correct even before the list mounts, and even if an option's children are more than plain text:

```ts
Select(
	{
		items: [
			{ value: "apple", label: "Apple" },
			{ value: "banana", label: "Banana" },
		],
	},
	SelectTrigger(SelectValue({ placeholder: "Select a fruit" })),
	SelectContent(SelectItem({ value: "apple" }, "Apple"), SelectItem({ value: "banana" }, "Banana")),
);
```

Without `items`, the label is the item's `label` prop, or the text content of the option. A sole string child is available immediately; richer children are read once the option mounts.

`placeholder` is shown when nothing is selected. Omit `render` and a single select prints that label, while a multiple select joins labels with a comma.

`render` is for custom markup. Discriminate on `props.type`: `value` is the stored ids (`Signal<ItemValue | null>` or `Signal<ItemValue[]>`, where `ItemValue` is `string | number`), and `selected` is `{ value, label }` or an array of those:

```ts
SelectValue({
	placeholder: "Select a fruit",
	render: (props) => {
		if (props.type === "single") {
			return props.selected.bind((item) => item?.label ?? "Select a fruit");
		}
		return props.selected.bind((items) =>
			items.length === 0 ? "Select toppings" : items.map((item) => item.label).join(", "),
		);
	},
});
```

## Groups

`SelectGroup` wraps related items in `role="group"`. Put a `SelectGroupHeading` inside it to name the group; the group points `aria-labelledby` at that heading.

```ts
SelectContent(
	SelectGroup(
		SelectGroupHeading("Citrus"),
		SelectItem({ value: "orange" }, "Orange"),
		SelectItem({ value: "lemon" }, "Lemon"),
	),
	SelectGroup(SelectGroupHeading("Berries"), SelectItem({ value: "blueberry" }, "Blueberry")),
);
```

<div data-demo="select-group" data-demo-description="A fruit select grouped into Citrus, Berries, and Tropical; the current selection is echoed in text below."></div>

## The trigger and the content

`SelectTrigger` renders a `Button`. Clicking it toggles the list.

`SelectContent` is a `Div` with `role="listbox"`. Place it next to the trigger. `side`, `align`, and `offset` are the same placement props as [Popover](/primitives/docs/popover):

```ts
SelectContent(
	{ side: "bottom", align: "start", offset: 4 },
	SelectItem({ value: "apple" }, "Apple"),
);
```

## Items

`SelectItem` is a `Div` with `role="option"`. Clicking it selects that value (or toggles it when `type` is `"multiple"`). Selected items set `aria-selected` and `data-selected`. Highlighted items set `data-highlighted`. Disabled items set `data-disabled` and `aria-disabled`, and cannot be selected. Pass `label` when the visible children are not the typeahead/display text.

```ts
SelectItem({ value: "apple" }, "Apple");
SelectItem({ value: "us", label: "United States" }, "US");
```

## Styling

Trigger and content expose `data-state` as `"open"` or `"closed"`. Content also sets `data-side` (`"top"`, `"bottom"`, `"left"`, `"right"`) so motion can slide in from the trigger. Items expose `data-selected`, `data-highlighted`, and `data-disabled`.

Positioning writes CSS variables on the content: `--ip-select-content-transform-origin` for origin-aware scale, `--ip-select-anchor-width` / `--ip-select-anchor-height` to match the trigger, and `--ip-select-content-available-width` / `--ip-select-content-available-height` to stay inside the viewport.

```ts
SelectTrigger(
	{ class: "flex h-9 w-48 items-center justify-between rounded-md border px-3 text-sm" },
	SelectValue({ placeholder: "Select a fruit" }),
);

SelectContent(
	{
		class:
			"absolute z-50 min-w-32 origin-(--ip-select-content-transform-origin) rounded-md border bg-popover p-1 shadow-md transition data-[state=closed]:hidden data-[state=closed]:data-[side=bottom]:-translate-y-2",
	},
	SelectItem(
		{
			value: "apple",
			class:
				"rounded-sm px-2 py-1.5 text-sm data-selected:bg-accent/50 data-highlighted:bg-accent data-selected:data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50",
		},
		"Apple",
	),
);
```

`data-state` is there for visibility and open versus closed. `data-side` is the actual placed side (after flip), so enter and exit stay pointed at the trigger.

## API Reference

<div data-api="select"></div>
