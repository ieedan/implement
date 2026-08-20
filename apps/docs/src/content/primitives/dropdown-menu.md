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
	{},
	DropdownMenuTrigger({}, "Open"),
	DropdownMenuContent(
		{},
		DropdownMenuItem({ onSelect: () => save() }, "Save"),
		DropdownMenuItem({ onSelect: () => rename() }, "Rename…"),
	),
);
```

Each part takes a props object first and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Div` or `Button`.

## Open state

`DropdownMenu` owns whether the menu is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside. Clicking the trigger toggles; Escape, selecting an item, or interacting outside closes.

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

## Structure

`DropdownMenuGroup` wraps related items in `role="group"`; give the group a name with `DropdownMenuGroupHeading`, and the group labels itself with it. `DropdownMenuSeparator` draws a `role="separator"` line between sections. `DropdownMenuPortal` is the core Portal helper for escaping overflow and stacking contexts.

## Submenus

`DropdownMenuSub` nests a menu inside a content. Its `DropdownMenuSubTrigger` is a regular item of the parent — arrows reach it, it highlights like the rest — that opens the `DropdownMenuSubContent` beside it instead of selecting:

```ts
DropdownMenuSub(
	{},
	DropdownMenuSubTrigger({}, "Invite people"),
	DropdownMenuSubContent(
		{},
		DropdownMenuItem({ onSelect: () => byEmail() }, "Email"),
		DropdownMenuItem({ onSelect: () => byLink() }, "Copy invite link"),
	),
);
```

The submenu opens when the pointer rests on the trigger (`openDelay`, default 100ms), or with ArrowRight, Enter, or Space — keyboard opens focus its first item. ArrowLeft inside the panel closes it and returns focus to the trigger; moving the pointer to a sibling item closes it too. Selecting an item inside a submenu closes the whole menu, and submenus nest as deep as you need.

## Keyboard

The trigger opens with Enter, Space, or ArrowDown — keyboard opens focus the first item. Inside, ArrowUp and ArrowDown move (wrapping unless `loop: false`), Home and End jump to the ends, typing a character jumps to the next item starting with it, Enter and Space activate, and Escape closes and returns focus to the trigger. Tab closes the menu, since a menu is not part of the page's tab order.

## Positioning and styling

`DropdownMenuContent` positions against the trigger with `side`, `align`, and `offset`, and stays put on scroll and resize. Like [Popover](/primitives/docs/popover), the primitive does not hide the closed panel — style it against `data-state`:

```ts
DropdownMenuContent({
	class: "absolute z-50 min-w-32 rounded-md border bg-popover p-1 data-[state=closed]:hidden",
});
```

Items expose `data-highlighted` while focused, so hover and keyboard highlight are one selector; checkbox and radio items expose `data-state` as `"checked"` or `"unchecked"`. Every part sets a `data-dropdown-menu-*` attribute.

## API Reference

<div data-api="dropdown-menu"></div>
