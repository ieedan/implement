---
title: Select
description: Choose one value, or several, from a list of options.
section: Components
---

<div data-demo="select"></div>

A select is a button that opens a list of options. `Select` is the root, `SelectTrigger` is the control that toggles it, `SelectValue` is the selected label inside the trigger, `SelectContent` is the list, and `SelectItem` is one option.

```ts
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@implementjs/primitives";

Select(
	{},
	SelectTrigger(
		{},
		SelectValue({
			render: (props) => {
				if (props.type === "single") {
					return props.value.bind((v) => v ?? "Select a fruit");
				}
				return props.value.bind((v) => v.join(", "));
			},
		}),
	),
	SelectContent(
		{},
		SelectItem({ value: "apple" }, "Apple"),
		SelectItem({ value: "banana" }, "Banana"),
	),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props on the trigger, content, and items are forwarded onto the underlying `Button` or `Div`.

## Open state

`Select` owns whether the list is open. Pass a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged):

```ts
const open = signal(false);

Select(
	{ open },
	SelectTrigger(
		{},
		SelectValue({
			render: (props) => {
				if (props.type === "single") {
					return props.value.bind((v) => v ?? "Select");
				}
				return props.value.bind((v) => v.join(", "));
			},
		}),
	),
	SelectContent({}, SelectItem({ value: "a" }, "A")),
);

Button({ onClick: () => open.set(false) }, "Close");
```

The primitive does not hide the content for you. Bind `hidden` to `open`, or style visibility yourself, the same way [Popover](/primitives/docs/popover) leaves `data-state` to CSS.

## Single or multiple

`type` defaults to `"single"`: choosing an item sets `value` to that item's string. Pass `"multiple"` to toggle items in and out of an array instead.

```ts
const fruit = signal<string | null>(null);

Select(
	{ value: fruit },
	SelectTrigger(
		{},
		SelectValue({
			render: (props) => {
				if (props.type === "single") {
					return props.value.bind((v) => v ?? "Select a fruit");
				}
				return props.value.bind((v) => v.join(", "));
			},
		}),
	),
	SelectContent({}, SelectItem({ value: "apple" }, "Apple")),
);
```

```ts
const toppings = signal<string[]>([]);

Select(
	{ type: "multiple", value: toppings },
	SelectTrigger(
		{},
		SelectValue({
			render: (props) => {
				if (props.type === "multiple") {
					return props.value.bind((v) => (v.length === 0 ? "Select toppings" : v.join(", ")));
				}
				return props.value.bind((v) => v ?? "");
			},
		}),
	),
	SelectContent({}, SelectItem({ value: "olives" }, "Olives")),
);
```

Every item needs a stable `value`. That string is what the root tracks, so it also has to be unique within the select.

<div data-demo="select-multiple"></div>

## The selected label

`SelectValue` belongs inside the trigger. The root stores item `value` strings; `render` turns those into a label. Discriminate on `props.type` so `value` is `Signal<string | null>` when the select is `"single"` and `Signal<string[]>` when it is `"multiple"`:

```ts
const labels: Record<string, string> = {
	apple: "Apple",
	banana: "Banana",
};

SelectValue({
	render: (props) => {
		if (props.type === "single") {
			return props.value.bind((v) => (v == null ? "Select a fruit" : labels[v]));
		}
		return props.value.bind((v) =>
			v.length === 0 ? "Select toppings" : v.map((id) => labels[id]).join(", "),
		);
	},
});
```

Omit `render` and it prints the raw value, or joins multiple values with a comma.

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

`SelectItem` is a `Div` with `role="option"`. Clicking it selects that value (or toggles it when `type` is `"multiple"`). Selected items set `aria-selected` and `data-selected`. Highlighted items set `data-highlighted`. Disabled items set `data-disabled` and `aria-disabled`, and cannot be selected.

```ts
SelectItem({ value: "apple" }, "Apple");
```

## Styling

Trigger, content, and items expose `data-select-*` attributes so you can target them in CSS. Content also gets `data-side` and `data-align` once it is placed. Items expose `data-selected`, `data-highlighted`, and `data-disabled`.

Positioning writes CSS variables on the content: `--ip-select-content-transform-origin` for origin-aware scale, `--ip-select-anchor-width` / `--ip-select-anchor-height` to match the trigger, and `--ip-select-content-available-width` / `--ip-select-content-available-height` to stay inside the viewport.

```ts
SelectTrigger(
	{ class: "flex h-9 w-48 items-center justify-between rounded-md border px-3 text-sm" },
	SelectValue({
		render: (props) => {
			if (props.type === "single") {
				return props.value.bind((v) => v ?? "Select a fruit");
			}
			return props.value.bind((v) => v.join(", "));
		},
	}),
);

SelectContent(
	{
		class:
			"absolute z-50 min-w-32 origin-(--ip-select-content-transform-origin) rounded-md border bg-popover p-1 shadow-md",
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

## API Reference

<div data-api="select"></div>
