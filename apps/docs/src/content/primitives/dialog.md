---
title: Dialog
description: A modal window that interrupts the page until the user dismisses it.
section: Components
---

<div data-demo="dialog" data-demo-description="An “Edit profile” button opening a modal dialog with a title, description, name, username, and role fields, and a save button; the page behind is dimmed by an overlay."></div>

A dialog is a panel that opens over the page. `Dialog` is the root, `DialogTrigger` is the control that toggles it, and `DialogContent` is the panel. Wrap the overlay and panel in `DialogPortal` when they need to escape overflow, and put `DialogClose` inside the panel for a dismiss control.

```ts
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "@implementjs/primitives";

Dialog(
	DialogTrigger("Edit profile"),
	DialogPortal(
		DialogOverlay(),
		DialogContent(
			DialogTitle("Edit profile"),
			DialogDescription("Make changes to your profile here."),
			DialogClose("Save changes"),
		),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props on the trigger, overlay, content, title, description, and close are forwarded onto the underlying `Button`, `Div`, `H2`, or `P`.

## Open state

`Dialog` owns whether the panel is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

Dialog({ open }, DialogTrigger("Edit profile"), DialogContent("Hello"));

Button({ onClick: () => open.set(false) }, "Close");
```

If it starts open (`open: true`, or a signal that's already true) focus moves into the panel on mount. Closing returns focus to the trigger that opened it, or the one marked `default`.

While open, the page behind cannot scroll. Pass `preventScroll: false` to leave it scrollable. The overlay and panel can still scroll if you give them `overflow`.

`onOpenChange` reports every open and close, whether it came from a trigger, a close button, Escape, or a write to a signal you passed in.

## Overlay and content

`DialogOverlay` is a `Div` that covers the page behind the panel. `DialogContent` is a `Div` with `role="dialog"` and `aria-modal`. Style them against `data-state`; the primitive does not hide them for you, and it does not position the panel. Center it with CSS.

Clicking the overlay dismisses the dialog, because the overlay sits outside the content.

## Title and description

`DialogTitle` is an `H2` and `DialogDescription` is a `P`. Put them inside the content. The content's `aria-labelledby` and `aria-describedby` point at them, so the accessible name comes from the heading instead of the trigger.

```ts
DialogContent(DialogTitle("Edit profile"), DialogDescription("Make changes to your profile here."));
```

If you skip the title, set `aria-label` on the content yourself.

## Portal

`DialogPortal` is the [Portal](/docs/portal) helper under a dialog name. It renders its children into `document.body` by default so the overlay and panel are not clipped by `overflow` or trapped in a parent stacking context. Context still resolves from where you declared it.

Wrap `DialogOverlay` and `DialogContent` in it. Chain `.To(target)` or pass `to` to pick a different parent, and `disabled` to mount in place instead.

```ts
DialogPortal(DialogOverlay(), DialogContent("Hello"));

DialogPortal({ to: overlayRoot }, DialogOverlay(), DialogContent("Hello"));
```

## Close

`DialogClose` is a `Button` that sets the dialog closed. Put it inside the content for a Done or dismiss control. You can still close from outside by writing the `open` signal. Escape and clicking outside the content also close it.

```ts
DialogContent("Place content for the dialog here.", DialogClose("Done"));
```

## Multiple triggers

A dialog can have more than one trigger. They share a single panel. Click the same trigger again to close; click a different one to keep it open and remember that button for focus return.

When the dialog starts open, it still has to pick a trigger to return focus to. That's the first trigger in the tree, unless you pass `default` on a different one:

```ts
Dialog(
	{ open: true },
	DialogTrigger("Left"),
	DialogTrigger({ default: true }, "Center"),
	DialogTrigger("Right"),
	DialogContent("Starts open. Closing returns focus to Center."),
);
```

## Nested

Each `Dialog` provides its own context, so a second root inside the content talks to its own trigger, panel, and close. Put the inner trigger in the outer panel.

Nested dialogs know their parent. Overlay and content get `data-nested` when they sit inside another dialog. While the inner one is open, every ancestor gets `data-nested-open`, `data-nested-count`, and `--ip-nested-count` so you can scale those panels back into a stack. Nested dialogs also set `--ip-nested-level` (0 for the outermost) so you can raise their `z-index` above the parent. Closing a parent closes the nested dialogs with it, so both can portal to `document.body` without leaving an orphan panel behind.

Keep the inner portal enabled. If you disable it, the nested panel lives inside the parent and scales with it instead of stacking on top.

```ts
Dialog(
	DialogTrigger("Share"),
	DialogPortal(
		DialogOverlay(),
		DialogContent(
			DialogTitle("Share"),
			DialogDescription("Anyone with the link can view this project."),
			Dialog(
				DialogTrigger("Invite"),
				DialogPortal(
					DialogOverlay(),
					DialogContent(
						DialogTitle("Invite"),
						DialogDescription("They'll get an email to join this project."),
						DialogClose("Send invite"),
					),
				),
			),
		),
	),
);
```

<div data-demo="dialog-nested" data-demo-description="A Share dialog listing who has access, with an Invite button that opens a nested dialog to send an email invite; the parent scales back in the stack and returns when Invite closes."></div>

Style the stack against those attributes. `--ip-nested-count` is the number of open descendants, so deeper stacks can recede further. `--ip-nested-level` is this dialog's depth, so nested panels paint above the parent even when the parent is attached to the document later:

```ts
DialogContent({
	class:
		"fixed top-1/2 left-1/2 z-[calc(50+var(--ip-nested-level,0))] -translate-x-1/2 -translate-y-1/2 transition-[scale,translate] data-[state=open]:scale-[calc(1-0.05*var(--ip-nested-count,0))] data-[nested-open]:-translate-y-[calc(50%+(0.5rem*var(--ip-nested-count,0)))]",
});

DialogOverlay({
	class:
		"fixed inset-0 z-[calc(50+var(--ip-nested-level,0))] bg-black/50 data-[nested]:bg-transparent",
});
```

## Styling

Trigger, overlay, and content expose `data-state` as `"open"` or `"closed"`. Overlay and content stay in the tree while closed; hide them with CSS. Center the content with `fixed` and a transform, not floating UI.

```ts
DialogTrigger({ class: "rounded-md border px-3 py-2 text-sm" }, "Edit profile");

DialogOverlay({
	class: "fixed inset-0 z-50 bg-black/50 data-[state=closed]:hidden data-[state=closed]:opacity-0",
});

DialogContent(
	{
		class:
			"fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=closed]:hidden data-[state=closed]:scale-95",
	},
	DialogTitle({ class: "text-lg font-semibold" }, "Edit profile"),
	DialogDescription(
		{ class: "text-sm text-muted-foreground" },
		"Make changes to your profile here.",
	),
);
```

`data-state` is there for visibility and open versus closed. The overlay sits behind the panel; put it before `DialogContent` in the portal so the panel stacks on top. Nested dialogs add `data-nested`, `data-nested-open`, and `--ip-nested-count` for stack motion, covered above.

## API Reference

<div data-api="dialog"></div>
