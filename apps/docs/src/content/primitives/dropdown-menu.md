---
title: Dropdown Menu
description: A menu of actions opened from a button.
section: Components
---

<div data-demo="dropdown-menu"></div>

A dropdown menu shows a list of actions when its trigger is pressed. `DropdownMenu` is the root, `DropdownMenuTrigger` the button, and `DropdownMenuContent` the floating panel of items. It shares its content, items, and keyboard model with [Context Menu](/primitives/docs/context-menu) and [Menubar](/primitives/docs/menubar) — only how the menu opens differs.

```ts
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@implementjs/primitives";

DropdownMenu(
	DropdownMenuTrigger("Open"),
	DropdownMenuContent(
		DropdownMenuItem({ onSelect: () => save() }, "Save"),
		DropdownMenuItem({ onSelect: () => rename() }, "Rename…"),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

## Open state

`DropdownMenu` owns whether the menu is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside. Clicking the trigger toggles; Escape, selecting an item, or interacting outside closes.

`onOpenChange` reports every open and close, whether it came from the trigger, a selected item, Escape, or a write to a signal you passed in. Submenus take the same prop on `DropdownMenuSub`.

## Items

`DropdownMenuItem` runs `onSelect` when clicked or activated with Enter or Space, then closes the menu — pass `closeOnSelect: false` to keep it open. `disabled` items are skipped by the keyboard and set `data-disabled`.

Beyond the plain item there are stateful ones:

- `DropdownMenuCheckboxItem` holds a `checked` boolean (`role="menuitemcheckbox"`); selecting toggles it.
- `DropdownMenuRadioGroup` holds a `value`, and each `DropdownMenuRadioItem` inside it is one choice (`role="menuitemradio"`).

Both accept signals, so the menu state and your app state are the same thing:

```ts
const showStatusBar = signal(true);

DropdownMenuCheckboxItem({ checked: showStatusBar, closeOnSelect: false }, "Status bar");
```

When several checkbox items belong together, `DropdownMenuCheckboxGroup` holds all of them as one array of values instead of a boolean each. Give every item inside it a `value`, and the group's array is the set that is checked — selecting an item adds or removes its value:

```ts
const visible = signal(["status-bar", "activity-bar"]);

DropdownMenuCheckboxGroup(
	{ value: visible },
	DropdownMenuGroupHeading("Panels"),
	DropdownMenuCheckboxItem({ value: "status-bar", closeOnSelect: false }, "Status bar"),
	DropdownMenuCheckboxItem({ value: "activity-bar", closeOnSelect: false }, "Activity bar"),
	DropdownMenuCheckboxItem({ value: "panel", closeOnSelect: false }, "Panel"),
);
```

The group is a `role="group"` like `DropdownMenuGroup`, so a `DropdownMenuGroupHeading` placed inside names it. Inside a group the group's array owns each item's checked state and the item's own `checked` prop is ignored; an item with no `value` keeps its own boolean.

Item values are strings or numbers, in the checkbox group and in the radio group alike, so a row id from a database can go straight in without being stringified and parsed again:

```ts
const size = signal<number | null>(14);

DropdownMenuRadioGroup(
	{ value: size },
	DropdownMenuRadioItem({ value: 12 }, "12px"),
	DropdownMenuRadioItem({ value: 14 }, "14px"),
);
```

The DOM only speaks strings, so `data-value` on the item is the number written out. Values are matched by identity, though, so `12` and `"12"` are two different items — pick one shape per group.

### A checkbox indicator, and two click targets

A checkbox item is a `Div` you fill yourself, so the checked indicator is whatever you draw against `data-state` — a check, a dot, or a checkbox like a label picker's. And because `closeOnSelect` is a property of the _item_, an element nested inside it can opt out of that behavior on its own: stop the click before it reaches the item and the item never selects, so the menu stays open.

That is the whole trick behind the pattern below. Clicking the checkbox toggles the label and leaves the menu open for the next one; clicking anywhere else on the row toggles it and closes. On the primitive the indicator is just the first child you pass; the demo goes through the [styled item](/ui/dropdown-menu)'s `indicator` prop, which swaps the check it would otherwise render.

<div data-demo="dropdown-menu-labels" data-demo-description="A “Labels” menu of six colored labels; each row's checkbox toggles without closing, while clicking the rest of the row toggles and closes."></div>

The item stays a single `role="menuitemcheckbox"` — the checkbox is `aria-hidden` decoration with a click handler, not a nested control — so the row keeps one accessible name and one checked state. The cost is that the split is pointer-only: Enter and Space activate the row, which toggles _and_ closes. If keyboard users need to check several labels in one pass, put `closeOnSelect: false` on the items and let the row behave like the checkbox does.

## Structure

`DropdownMenuGroup` wraps related items in `role="group"`; give the group a name with `DropdownMenuGroupHeading`, and the group labels itself with it. `DropdownMenuSeparator` draws a `role="separator"` line between sections. `DropdownMenuPortal` is the core Portal helper for escaping overflow and stacking contexts.

## Submenus

`DropdownMenuSub` nests a menu inside a content. Its `DropdownMenuSubTrigger` is a regular item of the parent — arrows reach it, it highlights like the rest — that opens the `DropdownMenuSubContent` beside it instead of selecting:

```ts
DropdownMenuSub(
	DropdownMenuSubTrigger("Invite people"),
	DropdownMenuSubContent(
		DropdownMenuItem({ onSelect: () => byEmail() }, "Email"),
		DropdownMenuItem({ onSelect: () => byLink() }, "Copy invite link"),
	),
);
```

The submenu opens when the pointer rests on the trigger (`openDelay`, default 100ms), or with ArrowRight, Enter, or Space — keyboard opens focus its first item. ArrowLeft inside the panel closes it and returns focus to the trigger; moving the pointer to a sibling item closes it too. Selecting an item inside a submenu closes the whole menu, and submenus nest as deep as you need.

## Keyboard

The trigger opens with Enter, Space, or ArrowDown — keyboard opens focus the first item. Inside, ArrowUp and ArrowDown move (wrapping unless `loop: false`), Home and End jump to the ends, typing a character jumps to the next item starting with it, Enter and Space activate, and Escape closes and returns focus to the trigger. Tab closes the menu, since a menu is not part of the page's tab order.

## Positioning and styling

`DropdownMenuContent` positions against the trigger with `side`, `align`, and `offset`, and stays put on scroll and resize. Like [Popover](/primitives/docs/popover), the primitive does not hide the closed panel — style it against `data-state`. While open, the page behind cannot scroll; pass `preventScroll: false` on the root to leave it scrollable.

```ts
DropdownMenuContent({
	class: "absolute z-50 min-w-32 rounded-md border bg-popover p-1 data-[state=closed]:hidden",
});
```

Items expose `data-highlighted` while focused, so hover and keyboard highlight are one selector; checkbox and radio items expose `data-state` as `"checked"` or `"unchecked"`. Every part sets a `data-dropdown-menu-*` attribute.

## API Reference

<div data-api="dropdown-menu"></div>
