---
title: Tooltip
description: A short label that appears when the pointer rests on a control or it takes keyboard focus.
section: Components
---

<div data-demo="tooltip" data-demo-description="Two buttons side by side; resting the pointer on one reveals a small “Add to library” bubble above it, and moving to the second opens its bubble with no delay."></div>

A tooltip labels a control when the pointer rests on it or it takes keyboard focus. `Tooltip` is the root, `TooltipTrigger` is the control, and `TooltipContent` is the bubble. Wrap the bubble in `TooltipPortal` when it needs to escape overflow, and wrap a group of tooltips in `TooltipProvider` so they share timing.

```ts
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipProvider,
	TooltipTrigger,
} from "@implementjs/primitives";

TooltipProvider(
	{},
	Tooltip({}, TooltipTrigger({}, "Hover"), TooltipPortal(TooltipContent({}, "Add to library"))),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props on the trigger and the content are forwarded onto the underlying `Button` or `Div`.

A tooltip is a label, not a place to put content. It never opens on touch, nothing inside it is reachable with the keyboard, and it closes the moment the trigger is clicked, blurred, or scrolled away — so put nothing in it the user can't live without.

## Provider and delays

Tooltips share timing through `TooltipProvider`: `delayDuration` (default `700`) is how long the pointer must rest before the bubble opens, so sweeping across a toolbar doesn't flash a label for every button. Once one tooltip closes, `skipDelayDuration` (default `300`) is the window in which the next trigger opens instantly instead of waiting again — that's what makes moving along a toolbar feel like one tooltip sliding between buttons.

```ts
TooltipProvider(
	{ delayDuration: 300, skipDelayDuration: 150 },
	Tooltip({}, TooltipTrigger({}, "Bold"), TooltipContent({}, "Bold")),
	Tooltip({}, TooltipTrigger({}, "Italic"), TooltipContent({}, "Italic")),
);
```

The provider also guarantees only one of its tooltips is open at a time. It is optional — a `Tooltip` without one behaves as if wrapped in a provider with the defaults — but without a shared provider each tooltip times itself, and the skip-delay handoff between them is lost.

Every provider prop except `skipDelayDuration` can be overridden per tooltip by passing the same prop to `Tooltip`.

## The trigger and the content

`TooltipTrigger` renders a `Button`. Resting the pointer on it opens the bubble after the delay; keyboard focus opens it immediately, with no delay. Clicking the trigger closes it (pass `disableCloseOnTriggerClick` to keep it up), as do blur, `Escape`, and scrolling the trigger's container. Pass `ignoreNonKeyboardFocus` when a mouse press on the trigger shouldn't pop the bubble open under the cursor.

`TooltipContent` is a `Div` with `role="tooltip"`, and while open the trigger points at it with `aria-describedby` — so the bubble's text is the trigger's accessible description. Keep it to text.

By default the bubble is hoverable: the pointer can travel from the trigger onto the bubble without it closing, along a safe polygon between the two. Pass `disableHoverableContent` to close as soon as the pointer leaves the trigger instead.

## Open state

`Tooltip` owns whether the bubble is open. Hover and focus drive it, but you can seed it with a boolean or hand it a [signal](/docs/signals) to read and write from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

Tooltip({ open }, TooltipTrigger({}, "Hover"), TooltipContent({}, "Hello"));

Button({ onClick: () => open.set(false) }, "Close");
```

`disabled` turns a tooltip off — on the provider for all of them, or per tooltip or per trigger:

```ts
Tooltip({ disabled: true }, TooltipTrigger({}, "Hover"), TooltipContent({}, "Never opens."));
```

## Portal

`TooltipPortal` is the [Portal](/docs/portal) helper under a tooltip name. It renders its children into `document.body` by default so the bubble is not clipped by `overflow` or trapped in a parent stacking context. Context still resolves from where you declared it.

```ts
TooltipPortal(TooltipContent({}, "Hello"));

TooltipPortal({ to: overlayRoot }, TooltipContent({}, "Hello"));
```

## Styling

Trigger and content expose `data-state` as `"delayed-open"`, `"instant-open"`, or `"closed"` — `"delayed-open"` when the bubble opened by waiting through the hover delay, `"instant-open"` when it skipped it (keyboard focus, or another tooltip just closed). Animate the two differently, or treat anything that isn't `"closed"` as open. Content also sets `data-side` (`"top"`, `"bottom"`, `"left"`, `"right"`) and `data-align`, so motion can grow out of the trigger.

Positioning writes CSS variables on the content: `--ip-tooltip-content-transform-origin` for origin-aware scale, `--ip-tooltip-anchor-width` / `--ip-tooltip-anchor-height` to match the trigger, and `--ip-tooltip-content-available-width` / `--ip-tooltip-content-available-height` to stay inside the viewport.

```ts
TooltipTrigger({ class: "rounded-md border px-3 py-2 text-sm" }, "Hover");

TooltipContent(
	{
		class:
			"absolute z-50 w-fit origin-(--ip-tooltip-content-transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-[opacity,translate,scale,display] transition-discrete data-[state=closed]:hidden data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=closed]:data-[side=top]:translate-y-2 starting:not-data-[state=closed]:scale-95 starting:not-data-[state=closed]:opacity-0",
	},
	"Add to library",
);
```

`data-state` is there for visibility and open versus closed. `data-side` is the actual placed side (after flip), so enter and exit stay pointed at the trigger.

## API Reference

<div data-api="tooltip"></div>
