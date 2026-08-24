---
title: Drawer
description: A panel that slides in from an edge of the screen, and can be thrown back out.
section: Components
---

<div data-demo="drawer" data-demo-description="A “Move goal” button opening a panel from the bottom of the screen with a grab handle, a calorie counter with minus and plus buttons, and Submit and Cancel buttons; the panel can be dragged back down to dismiss it."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/drawer
```

jsrepo pulls `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/drawer.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="drawer"></div>

<div data-tabs-end></div>

## Usage

`DrawerContent` is the panel, and it brings the scrim and the portal with it: `DrawerOverlay` renders behind it and `DrawerPortal` mounts the pair on `document.body`, so neither is yours to place. Both stay exported for a layout that composes the panel itself out of the [primitives](/primitives/docs/drawer) — pairing them with the styled `DrawerContent` only gets you two scrims.

A grab handle is included. `showHandle: false` removes it, and `showCloseButton: true` adds an X in the corner the way [dialog](/ui/dialog) has one.

```ts
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
	DrawerTrigger,
} from "@/lib/components/ui/drawer";

Drawer(
	DrawerTrigger("Move goal"),
	DrawerContent(
		DrawerTitle("Move goal"),
		DrawerDescription("Set your daily activity goal."),
		DrawerClose({ variant: "default" }, "Submit"),
	),
);
```

The panel is a `flex flex-col` with nothing inside it, so the padding is yours. A centered column reads best on a phone and stops the panel from stretching a form across a desktop:

```ts
DrawerContent(Div({ class: "mx-auto flex w-full max-w-sm flex-col gap-6 p-4 pb-8" }, …));
```

## Direction

`direction` on the root picks the edge, and every part reads it from there — the panel anchors itself, rounds the inside corners, and turns the handle sideways for a left or right drawer.

```ts
Drawer({ direction: "right" }, DrawerTrigger("Filters"), DrawerContent(…));
```

<div data-demo="drawer-directions" data-demo-description="Four small buttons labelled top, right, bottom, and left, each opening a panel from that edge of the screen."></div>

A bottom or top drawer caps at 85% of the viewport; a left or right one is three quarters wide up to `max-w-sm`. Override any of it with `class`.

## Snap points

Give the root `snapPoints` and the panel gets resting positions instead of one open state. The styled content notices — under `data-snap-points` it fills the axis rather than capping, so the offset is what reveals part of it.

<div data-demo="drawer-snap-points" data-demo-description="A “Changelog” button opening a panel that rests at 40% of the screen, listing release notes; dragging it up expands it to three quarters and then to full height, and the scrim darkens as it goes."></div>

```ts
const snap = signal<number | string | null>(0.4);

Drawer(
	{ snapPoints: [0.4, 0.75, 1], activeSnapPoint: snap },
	DrawerTrigger("Changelog"),
	DrawerContent(
		DrawerTitle("Changelog"),
		Div({ class: "flex-1 overflow-y-auto overscroll-contain" }, …),
	),
);
```

The scrim's opacity is `--ip-drawer-fade`, which the drag writes directly, so it darkens as the panel comes up and clears as it goes back down. Below `fadeFromIndex` — the last snap point unless you say otherwise — it stays clear, which is what lets a drawer sit at 40% without dimming what is behind it.

A scrolling region inside the panel wants `overflow-y-auto overscroll-contain`. The drag knows to leave it alone until it has scrolled back to the top.

## Dragging

Everything about the gesture lives on the root: `dismissible: false` to take dismissal away, `handleOnly: true` to make the handle the only drag surface, `closeThreshold` for how far a slow drag has to go, `snapToSequentialPoint` to stop a hard fling from skipping snap points. See the [primitive](/primitives/docs/drawer#dragging) for what each one does.

Mark anything that wants the gesture for itself — a slider, a map — with `data-drawer-no-drag`:

```ts
DrawerContent(DrawerTitle("Layers"), Div({ "data-drawer-no-drag": "" }, MapCanvas()));
```

## Keyboards

An on-screen keyboard covers the bottom of the panel and the panel does not move, the way an iOS sheet behaves. Everything in it lays out in the room that is left, so a field near the top stays exactly where it was — and because nothing moved, the browser never scrolls the page to chase it.

`DrawerContent` does that by ending its column with a spacer as tall as `--ip-drawer-keyboard-inset` from the [primitive](/primitives/docs/drawer#on-screen-keyboards). A spacer rather than padding, so that reaching for `class` to set your own padding does not quietly take it away.

Its height cap grows by the same inset, so the 85dvh it holds the panel to is the part of the panel you can actually see. A bottom drawer with a keyboard up therefore takes the whole band above it, the way an iOS sheet does. If you set your own `max-h`, keep the inset in it — a flat cap squeezes the spacer back out and puts the end of your column behind the keyboard.

Put whatever must stay visible near the top of the panel, and give the part that can afford to shrink `min-h-0 flex-1 overflow-y-auto`.

## Scaling the page behind

`scaleBackground: true` marks the document while the drawer is open and leaves the transform to your stylesheet, so the page can shrink back the way it does on iOS. Put `data-drawer-wrapper` on the element that should shrink and add this to your CSS:

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

## Drawer or sheet?

Both are the [dialog](/ui/dialog) wearing a panel. `sheet` slides in and out, and that is all it does. Reach for the drawer when the gesture is the point — a phone-shaped surface you flick away, or one that rests at more than one height. On a desktop with a pointer they look the same; the difference is what a thumb can do with them.

That is why the [sidebar](/ui/sidebar) falls back to a drawer rather than a sheet below 768px, and why a modal that has to work on both often wants to be a [responsive dialog](/ui/responsive-dialog): a dialog where there is room for one, and a drawer where a thumb is what is reaching for it.

## Controlling it

Pass `open` as a signal to drive the drawer from outside, with or without a trigger:

```ts
const open = signal(false);

Drawer({ open }, DrawerContent(DrawerTitle("Saved")));
```

## API Reference

Every prop the styling does not consume is forwarded to the [Drawer primitive](/primitives/docs/drawer), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-drawer"></div>
