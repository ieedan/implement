---
title: Command
description: A filterable command menu that scores, sorts, and navigates items from a search input.
section: Components
---

<div data-demo="command" data-demo-description="A command palette with Suggestions and Settings groups; typing filters and re-ranks the items, and the last selection is echoed below."></div>

A command menu is a search input over a list of actions. `Command` is the root, `CommandInput` is the search box, `CommandList` is the results region, `CommandViewport` wraps everything inside the list, and `CommandItem` is one choice. Typing scores every item against the search, hides the misses, and sorts the best matches to the top. A highlight follows the keyboard — the arrow keys move it, Enter chooses it — while focus stays in the input.

```ts
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
	CommandViewport,
} from "@implementjs/primitives";

Command(
	{ label: "Command menu" },
	CommandInput({ placeholder: "Type a command..." }),
	CommandList(
		{},
		CommandViewport(
			{},
			CommandEmpty({}, "No results found."),
			CommandItem({ value: "calendar", onSelect: () => openCalendar() }, "Calendar"),
			CommandItem({ value: "settings", onSelect: () => openSettings() }, "Settings"),
		),
	),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Div`, `Input`, or `A`.

Unlike the popup primitives, `Command` renders in place — there is no trigger and no open state. Put it inside a [Dialog](/primitives/docs/dialog) to build a ⌘K palette.

## Search and value

The root owns two strings: `search` (what is typed) and `value` (the highlighted item). Pass [signals](/docs/signals) to control or observe either from outside:

```ts
const search = signal("");
const value = signal("");

Command(
	{ search, value },
	CommandInput({}),
	CommandList({}, CommandViewport({}, CommandItem({ value: "calendar" }, "Calendar"))),
);

search.set("cal"); // filters the list
value.onChange((current) => console.log("highlighted", current));
```

Every item needs a stable, unique `value`; it is what the search is scored against (along with `keywords`) and what the root tracks as the highlight. When omitted, the item's text content is used.

## Filtering

Scoring uses `computeCommandScore`, which favors continuous matches and word starts — typing "cal" ranks "Calendar" above "Local time". An item whose score is 0 gets the `hidden` attribute; the rest are re-ordered in the DOM by score, best first. Clearing the search restores the original order.

Pass `keywords` for aliases the search should also match, and `filter` to replace the scoring entirely:

```ts
CommandItem({ value: "trash", keywords: ["delete", "remove"] }, "Trash");

Command({
	filter: (value, search) => (value.startsWith(search) ? 1 : 0),
});
```

`shouldFilter: false` turns filtering and sorting off — useful when a server does the searching and you render only matching items yourself.

`CommandEmpty` renders only when the search leaves nothing visible. `CommandLoading` is a `role="progressbar"` region for async items. `CommandSeparator` hides itself while a search is active.

## Groups

`CommandGroup` wraps a `CommandGroupHeading` and a `CommandGroupItems`. The heading names the group (`aria-labelledby` points at it), and the whole group hides once every item inside it is filtered out. Groups need a unique `value` of their own when the search should sort them (best group first):

```ts
CommandGroup(
	{ value: "settings" },
	CommandGroupHeading({}, "Settings"),
	CommandGroupItems(
		{},
		CommandItem({ value: "profile" }, "Profile"),
		CommandItem({ value: "billing" }, "Billing"),
	),
);
```

## Keyboard

Focus stays in the input; keys bubble to the root. ArrowDown/ArrowUp move the highlight, Home/End jump to the first and last item, and Enter chooses the highlighted item (it runs that item's `onSelect`). Alt+arrow jumps by group, Meta+arrow to the ends. Ctrl+n/j and Ctrl+p/k mirror the arrows; pass `vimBindings: false` to turn them off. `loop: true` wraps at both ends. Disabled items are skipped.

## Grid mode

Pass `columns` to navigate the items as a grid: ArrowLeft/ArrowRight move within a row, ArrowUp/ArrowDown move between rows keeping the column, and each group starts a new row. The primitive tracks the grid logically — lay the items out with CSS to match, e.g. `grid-cols-5` when `columns` is 5:

```ts
Command(
	{ columns: 5 },
	CommandInput({}),
	CommandList(
		{},
		CommandViewport(
			{},
			CommandGroupItems(
				{ class: "grid grid-cols-5" },
				...emojis.map((emoji) => CommandItem({ value: emoji.name }, emoji.char)),
			),
		),
	),
);
```

<div data-demo="command-grid" data-demo-description="An emoji picker in grid mode: three groups laid out five columns wide, navigable in two dimensions with the arrow keys."></div>

## Items that navigate

`CommandLinkItem` renders an anchor instead of a `Div`, so choosing it navigates. Enter clicks the highlighted element, which follows the link:

```ts
CommandLinkItem({ value: "docs", href: "/docs" }, "Documentation");
```

## Styling

The highlighted item sets `data-selected`; disabled items set `data-disabled` and `aria-disabled`. Filtered-out parts (items, groups, the empty state, separators) get the native `hidden` attribute — keep it winning over any `display` utility classes (Tailwind's preflight already does). A `CommandViewport` directly inside the list reports its height as `--ip-command-list-height` on the list, for animating the list as results come and go.

```ts
CommandItem(
	{
		value: "calendar",
		class:
			"rounded-sm px-2 py-1.5 text-sm data-selected:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50",
	},
	"Calendar",
);
```

## API Reference

<div data-api="command"></div>
