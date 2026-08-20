---
title: Popover
description: Display rich content in a panel, triggered by a button.
section: Components
---

<div data-demo="popover" data-demo-description="An “Open popover” button revealing a small form panel: a Dimensions heading, four labeled inputs (width, max. width, height, max. height), and a Done close button."></div>

A popover is a small panel that opens from a button. `Popover` is the root, `PopoverTrigger` is the control that toggles it, and `PopoverContent` is the panel. Wrap the panel in `PopoverPortal` when it needs to escape overflow, and put `PopoverClose` inside the panel for a dismiss control.

```ts
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "@implementjs/primitives";

Popover(
	{},
	PopoverTrigger({}, "Open popover"),
	PopoverPortal(
		PopoverContent({}, "Place content for the popover here.", PopoverClose({}, "Done")),
	),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props on the trigger, content, and close are forwarded onto the underlying `Button` or `Div`.

## Open state

`Popover` owns whether the panel is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

Popover({ open }, PopoverTrigger({}, "Open popover"), PopoverContent({}, "Hello"));

Button({ onClick: () => open.set(false) }, "Close");
```

If it starts open (`open: true`, or a signal that's already true) the panel anchors to the first trigger in the tree, or the one marked `default`. Positioning runs on mount, once the nodes are in the document.

The page behind stays scrollable while the popover is open. Pass `preventScroll: true` to lock it.

## The trigger and the content

`PopoverTrigger` renders a `Button`. Clicking it toggles the popover. `PopoverContent` is a `Div` that holds whatever you put in the panel: text, a form, another component.

## Portal

`PopoverPortal` is the [Portal](/docs/portal) helper under a popover name. It renders its children into `document.body` by default so the panel is not clipped by `overflow` or trapped in a parent stacking context. Context still resolves from where you declared it.

Wrap `PopoverContent` in it. Chain `.To(target)` or pass `to` to pick a different parent, and `disabled` to mount in place instead. Nested popovers typically disable the inner portal so the nested panel stays in the outer overlay:

```ts
PopoverPortal(PopoverContent({}, "Hello"));

PopoverPortal({ to: overlayRoot, disabled: nested }, PopoverContent({}, "Hello"));
```

## Close

`PopoverClose` is a `Button` that sets the popover closed. Put it inside the content for a Done or dismiss control. You can still close from outside by writing the `open` signal.

```ts
PopoverContent({}, "Place content for the popover here.", PopoverClose({}, "Done"));
```

## Multiple triggers

A popover can have more than one trigger. They share a single panel, and clicking a trigger opens it against that button. Click the same trigger again to close; click a different one to move the panel.

When the popover starts open, it still has to pick an anchor. That's the first trigger in the tree, unless you pass `default` on a different one:

```ts
Popover(
	{ open: true },
	PopoverTrigger({}, "Left"),
	PopoverTrigger({ default: true }, "Center"),
	PopoverTrigger({}, "Right"),
	PopoverContent({}, "Starts open against Center."),
);
```

<div data-demo="popover-triggers" data-demo-description="One popover with three triggers (Left, Center, Right); the panel opens anchored to whichever trigger was clicked."></div>

## Nested

Each `Popover` provides its own context, so a second root inside the content talks to its own trigger, panel, and close. Put the inner trigger in the outer panel.

Disable the inner portal. If both teleport to `document.body`, closing the outer popover hides its content but leaves the inner panel on the page.

```ts
Popover(
	{},
	PopoverTrigger({}, "Open popover"),
	PopoverPortal(
		PopoverContent(
			{},
			"This is the outer popover.",
			Popover(
				{},
				PopoverTrigger({}, "Open nested"),
				PopoverPortal(
					{ disabled: true },
					PopoverContent({ side: "right" }, "This is nested inside the first one."),
				),
			),
		),
	),
);
```

<div data-demo="popover-nested" data-demo-description="An outer popover containing an “Open nested” trigger that opens a second popover to the side of the first."></div>

## Styling

Trigger and content expose `data-state` as `"open"` or `"closed"`. Content also sets `data-side` (`"top"`, `"bottom"`, `"left"`, `"right"`) so motion can slide in from the trigger.

Positioning writes CSS variables on the content: `--bits-popover-content-transform-origin` for origin-aware scale, `--bits-popover-anchor-width` / `--bits-popover-anchor-height` to match the trigger, and `--bits-popover-content-available-width` / `--bits-popover-content-available-height` to stay inside the viewport.

```ts
PopoverTrigger({ class: "rounded-md border px-3 py-2 text-sm" }, "Open popover");

PopoverContent(
	{
		class:
			"z-50 w-72 origin-(--bits-popover-content-transform-origin) max-h-(--bits-popover-content-available-height) rounded-md border bg-popover p-4 text-sm shadow-md transition data-[state=closed]:hidden data-[state=closed]:data-[side=bottom]:-translate-y-2",
	},
	"Place content for the popover here.",
);
```

`data-state` is there for visibility and open versus closed. `data-side` is the actual placed side (after flip), so enter and exit stay pointed at the trigger.

## API Reference

<div data-api="popover"></div>
