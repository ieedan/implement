---
title: Alert Dialog
description: A modal that demands a response before anything else can happen.
section: Components
---

<div data-demo="alert-dialog" data-demo-description="A “Delete account” button opening a confirmation dialog with a title, a warning description, and Cancel and Delete account buttons; the page behind is dimmed by an overlay."></div>

An alert dialog interrupts the page with a question the user has to answer — confirm a deletion, discard unsaved changes. It shares its machinery with [Dialog](/primitives/docs/dialog): `AlertDialog` is the root, `AlertDialogTrigger` opens it, `AlertDialogContent` is the panel. Instead of a generic close, it has two ends: `AlertDialogCancel` backs out and `AlertDialogAction` confirms.

```ts
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@implementjs/primitives";

AlertDialog(
	{},
	AlertDialogTrigger({}, "Delete account"),
	AlertDialogPortal(
		AlertDialogOverlay({}),
		AlertDialogContent(
			{},
			AlertDialogTitle({}, "Are you absolutely sure?"),
			AlertDialogDescription({}, "This action cannot be undone."),
			AlertDialogCancel({}, "Cancel"),
			AlertDialogAction({ onClick: () => deleteAccount() }, "Delete account"),
		),
	),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Button`, `Div`, `H2`, or `P`.

## How it differs from Dialog

Everything from [Dialog](/primitives/docs/dialog) — open state, multiple triggers, title and description wiring, the portal, nesting and stacks — works the same here. Three things change:

- The panel is `role="alertdialog"` instead of `role="dialog"`, so screen readers announce it as needing a response.
- Clicking outside does **not** dismiss it. The user has to pick an answer (or press Escape, which still cancels).
- When it opens, focus lands on `AlertDialogCancel` instead of the first focusable element, so Enter or Space backs out rather than confirming the destructive thing.

Use a plain dialog for forms and detail views the user can wander out of; use an alert dialog when leaving without answering would lose something.

## Cancel and action

`AlertDialogCancel` and `AlertDialogAction` are both `Button`s that close the dialog. The difference is intent: put the work on the action's `onClick`, and keep the cancel consequence-free.

```ts
AlertDialogContent(
	{},
	AlertDialogTitle({}, "Discard draft?"),
	AlertDialogCancel({}, "Keep editing"),
	AlertDialogAction({ onClick: () => discard() }, "Discard"),
);
```

The cancel button receives focus when the dialog opens. If you leave it out, focus falls back to the first focusable element in the panel, so consider what ends up under the user's finger.

## Open state

`AlertDialog` owns whether the panel is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside:

```ts
const open = signal(false);

AlertDialog({ open }, AlertDialogTrigger({}, "Delete"), AlertDialogContent({}, "Sure?"));

Button({ onClick: () => open.set(false) }, "Close");
```

Closing returns focus to the trigger that opened it, or the one marked `default`.

## Styling

Trigger, overlay, and content expose `data-state` as `"open"` or `"closed"`; cancel and action expose `data-alert-dialog-cancel` and `data-alert-dialog-action`. Overlay and content stay in the tree while closed; hide them with CSS and center the panel with `fixed` and a transform, exactly like Dialog.

```ts
AlertDialogOverlay({
	class: "fixed inset-0 z-50 bg-black/50 data-[state=closed]:hidden data-[state=closed]:opacity-0",
});

AlertDialogContent(
	{
		class:
			"fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=closed]:hidden data-[state=closed]:scale-95",
	},
	AlertDialogTitle({ class: "text-lg font-semibold" }, "Are you absolutely sure?"),
	AlertDialogDescription({ class: "text-sm text-muted-foreground" }, "This cannot be undone."),
);
```

## API Reference

<div data-api="alert-dialog"></div>
