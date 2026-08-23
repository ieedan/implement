---
title: Drawer
description: A panel that slides in from an edge, and can be thrown back out.
section: Components
---

<div data-demo="drawer" data-demo-description="A “Move goal” button opening a panel from the bottom of the screen with a grab handle, a calorie counter with minus and plus buttons, and Submit and Cancel buttons; the panel can be dragged back down to dismiss it."></div>

A drawer is a [dialog](/primitives/docs/dialog) you can throw back out. It is the same modal base — focus trap, Escape, outside dismissal, scroll lock, nesting, `aria-modal` — with a drag on top: the panel follows the pointer, rubber bands past its open position, and lands on a snap point or off the screen depending on how fast it was let go. This is a port of [Vaul](https://vaul.emilkowal.ski).

`Drawer` is the root, `DrawerTrigger` toggles it, `DrawerContent` is the panel, and `DrawerHandle` is the grab bar. Wrap the scrim and panel in `DrawerPortal` so they escape overflow.

```ts
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHandle,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
	DrawerTrigger,
} from "@implementjs/primitives";

Drawer(
	DrawerTrigger("Move goal"),
	DrawerPortal(
		DrawerOverlay(),
		DrawerContent(
			DrawerHandle(),
			DrawerTitle("Move goal"),
			DrawerDescription("Set your daily activity goal."),
			DrawerClose("Submit"),
		),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Everything the drawer does not consume is forwarded onto the underlying `Button`, `Div`, `H2`, or `P`.

## Direction

`direction` picks the edge the panel is anchored to, which is also the way it drags out. It defaults to `"bottom"`.

```ts
Drawer({ direction: "right" }, DrawerTrigger("Filters"), DrawerContent("…"));
```

<div data-demo="drawer-directions" data-demo-description="Four small buttons labelled top, right, bottom, and left, each opening a panel from that edge of the screen."></div>

The direction reaches the parts as `data-drawer-direction`, so one stylesheet can cover all four.

## Placing the panel

The primitive does not position or hide the panel — it only says where the drag has put it. `DrawerContent` writes `--ip-drawer-offset-x` and `--ip-drawer-offset-y`, a pair of px lengths that carry the drag and the active snap point together, with the cross-axis one always `0px`. Spend them on `translate` and pin the panel to its edge yourself:

```ts
DrawerContent({
	class: [
		"fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border-t bg-background",
		"[translate:var(--ip-drawer-offset-x)_var(--ip-drawer-offset-y)]",
		"transition-[translate,display] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transition-discrete",
		"data-[state=closed]:hidden data-[state=closed]:[translate:0_100%]",
		"starting:data-[state=open]:[translate:0_100%]",
		// while a finger is on it the panel is not animating, it is tracking
		"data-[dragging]:transition-none",
	],
});
```

`data-dragging` is the one rule that is not optional. A transition left on during a drag turns a panel that tracks the pointer into one that lags behind it.

## Dragging

A drag starts anywhere on the panel, unless `handleOnly` moves it to the handle. What happens on release depends on the gesture, not only where it ended:

- Past `closeThreshold` — a quarter of the panel by default — dismisses it.
- A flick faster than 0.4px/ms dismisses it however short it was.
- Anything else springs back.

Pulling the panel further open than it goes rubber bands instead of stopping dead. `dismissible: false` takes dismissal away from everything the drawer owns — the drag, Escape, the scrim, and `DrawerClose` — so drive `open` yourself. A drawer nested inside one that closes still goes with it, rather than being left on the page with nothing above it.

Two things a drag deliberately does not do. It does not start from a scroll container that is scrolled away from the edge the panel would leave from, and it does not start for `scrollLockTimeout` after one has scrolled — so a panel with a list in it scrolls to the top first and drags second. It also does not start from anything inside `[data-drawer-no-drag]`, which is the escape hatch for a slider, a map, or a canvas that wants the gesture for itself.

> [!NOTE]
> Give scrollable regions inside the panel `overscroll-behavior: contain`. Without it a touch that runs past the end of the list scrolls the page behind the drawer instead of doing nothing.

## Snap points

`snapPoints` gives the panel resting positions, ordered least to most of the screen. A number is a fraction of the viewport and a string is a length the viewport does not enter into:

```ts
Drawer({ snapPoints: [0.4, 0.75, 1] }, DrawerTrigger("Changelog"), DrawerContent("…"));

Drawer({ snapPoints: ["148px", 1] }, DrawerTrigger("Now playing"), DrawerContent("…"));
```

<div data-demo="drawer-snap-points" data-demo-description="A “Changelog” button opening a panel that rests at 40% of the screen, listing release notes; dragging it up expands it to three quarters and then to full height, and the scrim darkens as it goes."></div>

With snap points the panel should fill its axis — the offset is what reveals part of it — so style it `h-full` under `data-snap-points` rather than capping its height.

A release picks the nearest snap point. A flick moves one along, and a hard one (above 2px/ms) skips to the end, or dismisses if it was already at the smallest. `snapToSequentialPoint: true` turns off the skip, for a drawer where each stop matters.

Read or drive the current one with `activeSnapPoint`:

```ts
const snap = signal<number | string | null>(0.4);

Drawer({ snapPoints: [0.4, 0.75, 1], activeSnapPoint: snap }, …);

Button({ onClick: () => snap.set(1) }, "Expand");
```

The panel writes the index it is resting at as `data-snap-point`, so a header can lay itself out differently once the drawer is full height.

### Fading the scrim

`DrawerOverlay` writes `--ip-drawer-fade`, the opacity the scrim should have right now: 1 when it covers the page and 0 when it is clear. Without snap points it tracks the drag, so the page comes back as the panel is pulled away. With them it is clear below `fadeFromIndex` — the last snap point unless you say otherwise — and crosses to solid over the step into it, which is what lets a drawer sit at a third of the screen without dimming the page behind it.

```ts
DrawerOverlay({
	class: [
		"fixed inset-0 z-50 bg-black/50 [opacity:var(--ip-drawer-fade,1)]",
		"transition-[opacity,display] duration-500 transition-discrete",
		"data-[state=closed]:hidden data-[state=closed]:opacity-0",
		"data-[dragging]:transition-none",
	],
});
```

The overlay also carries `data-faded-in` while the panel rests at or above `fadeFromIndex`, for styling that has to be a step rather than a fraction.

## Handle

`DrawerHandle` is the grab bar. It renders a `Span` with `data-drawer-handle-hitarea` inside it, which is what a 44px touch target can be hung on without making the bar itself that big.

Tapping it steps to the next snap point and closes from the last one; `preventCycle` turns that off. A press held long enough to have been a drag does not count as a tap. With no snap points there is nothing to step through, so a tap does nothing.

`handleOnly` on the root makes it the only place a drag can start, for a panel whose whole body is interactive.

```ts
Drawer(
	{ handleOnly: true, snapPoints: [0.4, 1] },
	DrawerTrigger("Layers"),
	DrawerContent(DrawerHandle(), MapCanvas()),
);
```

## Scaling the page behind

`scaleBackground` marks the document while an outermost drawer is open — `data-drawer-open`, plus `--ip-drawer-scale` and `--ip-drawer-progress` — and leaves the transform to CSS. Mark the element that should shrink with `data-drawer-wrapper`:

```css
[data-drawer-wrapper] {
	transform-origin: top;
	transition:
		scale 0.5s cubic-bezier(0.32, 0.72, 0, 1),
		border-radius 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

html[data-drawer-open] {
	background: black;
}

html[data-drawer-open] [data-drawer-wrapper] {
	overflow: hidden;
	border-radius: calc(8px * (1 - var(--ip-drawer-progress, 0)));
	scale: var(--ip-drawer-scale, 1);
}
```

`--ip-drawer-scale` already folds the drag in: the page comes back to full size as the panel is pulled away, and the whole thing reverses if the drag springs back. Nested drawers leave the document alone — the thing behind them is another panel, not the page.

## Nested

Each `Drawer` provides its own context, so a second root inside the panel talks to its own trigger, panel, and handle. Nested drawers get the same stacking variables the [dialog](/primitives/docs/dialog#nested) does: `data-nested`, `data-nested-open`, `--ip-nested-count` for scaling the panel underneath, and `--ip-nested-level` for raising the one on top. Closing a parent closes the drawers nested in it.

## Title and description

`DrawerTitle` is an `H2` and `DrawerDescription` is a `P`. Put them inside the content; the panel's `aria-labelledby` and `aria-describedby` point at them. If you skip the title, set `aria-label` on the content yourself.

The handle is `aria-hidden`, so it is not a control anyone can reach — Escape, the scrim, and `DrawerClose` are what close the drawer without a pointer.

## What is not ported

Vaul's non-modal drawer (`modal={false}`), its iOS keyboard repositioning (`repositionInputs`, `fixed`), and its scroll restoration are not here. `preventScroll: false` covers the part of the first one that is about the page behind still scrolling.

## API Reference

<div data-api="drawer"></div>
