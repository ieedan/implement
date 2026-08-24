---
title: Link Preview
description: Show a preview of what a link points at when the pointer rests on it.
section: Components
---

<div data-demo="link-preview" data-demo-description="A sentence with the link “@ieedan” in it; resting the pointer on the link reveals a card with an avatar, the handle, a one-line bio, and a joined date."></div>

A link preview is a panel that appears when the pointer rests on a link, the way a repository or a profile card appears on GitHub. `LinkPreview` is the root, `LinkPreviewTrigger` is the link, and `LinkPreviewContent` is the panel. Wrap the panel in `LinkPreviewPortal` when it needs to escape overflow.

```ts
import {
	LinkPreview,
	LinkPreviewContent,
	LinkPreviewPortal,
	LinkPreviewTrigger,
} from "@implementjs/primitives";

LinkPreview(
	LinkPreviewTrigger({ href: "https://github.com/ieedan" }, "@ieedan"),
	LinkPreviewPortal(LinkPreviewContent("A preview of where the link goes.")),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props on the trigger and the content are forwarded onto the underlying `A` or `Div`.

This is a hover affordance, not a way to reach content. It never opens on touch, and everything inside the panel is taken out of the tab order, so put nothing in it that isn't also reachable somewhere else. While open, the page behind cannot scroll; pass `preventScroll: false` to leave it scrollable.

## The trigger

`LinkPreviewTrigger` renders an `A`. It is a real link: pass `href`, `target`, `rel`, and it navigates like any other. The preview is what hovering adds.

```ts
LinkPreviewTrigger(
	{ href: "https://github.com/ieedan", target: "_blank", rel: "noreferrer" },
	"@ieedan",
);
```

Resting the pointer on it opens the preview after `openDelay`; moving away closes it after `closeDelay`. Keyboard focus opens it too, but only when the focus is visible — clicking the link doesn't pop the panel open under your cursor.

## Delays

`openDelay` is how long the pointer has to rest before the panel appears, so sweeping across a paragraph of links doesn't flash a panel for each one. `closeDelay` is how long the panel stays after the pointer has actually left.

```ts
LinkPreview(
	{ openDelay: 300, closeDelay: 150 },
	LinkPreviewTrigger({ href: "/docs" }, "the docs"),
	LinkPreviewContent("Opens sooner, leaves sooner."),
);
```

Moving off the link toward the panel is not "leaving". While the preview is open it tracks a safe zone between the link and the panel, so the pointer can cut diagonally across the gap without the panel closing under it. The close only starts once the pointer leaves that zone — or stalls inside it, which reads as wandering rather than travelling.

## Open state

`LinkPreview` owns whether the panel is open. Hover and focus drive it, but you can seed it with a boolean or hand it a [signal](/docs/signals) to read and write from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

LinkPreview(
	{ open },
	LinkPreviewTrigger({ href: "/docs" }, "the docs"),
	LinkPreviewContent("Hello"),
);

Button({ onClick: () => open.set(false) }, "Close");
```

`disabled` turns the preview off without touching the link:

```ts
LinkPreview({ disabled: isCompact }, LinkPreviewTrigger({ href: "/docs" }, "the docs") /* … */);
```

`onOpenChange` reports every open and close, including the ones the delay timers drive.

## Selecting text in the panel

Text inside the panel is selectable. While a selection is being dragged — and while one stands — the panel stays open even if the pointer wanders off it, so the selection doesn't vanish mid-drag. Clicking elsewhere clears the selection and dismisses the panel.

## Portal

`LinkPreviewPortal` is the [Portal](/docs/portal) helper under a link preview name. It renders its children into `document.body` by default so the panel is not clipped by `overflow` or trapped in a parent stacking context — worth having when the link lives inside a scrolling column of prose. Context still resolves from where you declared it.

```ts
LinkPreviewPortal(LinkPreviewContent("Hello"));

LinkPreviewPortal({ to: overlayRoot }, LinkPreviewContent("Hello"));
```

## Styling

Trigger and content expose `data-state` as `"open"` or `"closed"`. Content also sets `data-side` (`"top"`, `"bottom"`, `"left"`, `"right"`) and `data-align`, so motion can grow out of the link.

Positioning writes CSS variables on the content: `--ip-link-preview-content-transform-origin` for origin-aware scale, `--ip-link-preview-anchor-width` / `--ip-link-preview-anchor-height` to match the link, and `--ip-link-preview-content-available-width` / `--ip-link-preview-content-available-height` to stay inside the viewport.

```ts
LinkPreviewTrigger({ class: "font-medium underline underline-offset-4" }, "@ieedan");

LinkPreviewContent(
	{
		class:
			"absolute z-50 w-80 origin-(--ip-link-preview-content-transform-origin) rounded-md border bg-popover p-4 text-sm shadow-md transition data-[state=closed]:hidden data-[state=closed]:data-[side=top]:translate-y-2",
	},
	"A preview of where the link goes.",
);
```

`data-state` is there for visibility and open versus closed. `data-side` is the actual placed side (after flip), so enter and exit stay pointed at the link.

## API Reference

<div data-api="link-preview"></div>
