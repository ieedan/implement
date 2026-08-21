---
title: Alert Dialog
description: A modal that interrupts the user and waits for a deliberate answer.
section: Components
---

<div data-demo="alert-dialog" data-demo-description="A “Delete account” button opening a confirmation dialog with a title, a warning description, and Cancel and Delete account buttons; the page behind is dimmed by an overlay."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/alert-dialog
```

jsrepo pulls `button` along with it.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/alert-dialog.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and `button` from the same directory — copy those in beside it too.

<div data-source="alert-dialog"></div>

<div data-tabs-end></div>

## Usage

An alert dialog is the [dialog](/ui/dialog) with the escape hatches removed: no close button in the corner, and no dismissing by clicking the overlay. The only ways out are `AlertDialogCancel` and `AlertDialogAction`, which is the point — the user has to answer.

`AlertDialogContent` renders its own `AlertDialogOverlay` inside an `AlertDialogPortal`, so the scrim is never yours to place. All three buttons take `variant` and `size` from the button styles, so a destructive confirmation is one prop.

```ts
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/lib/components/ui/alert-dialog";

AlertDialog(
	AlertDialogTrigger({ variant: "destructive" }, "Delete account"),
	AlertDialogContent(
		AlertDialogTitle("Are you absolutely sure?"),
		AlertDialogDescription("This permanently deletes your account."),
		AlertDialogCancel("Cancel"),
		AlertDialogAction({ variant: "destructive" }, "Delete account"),
	),
);
```

## Stacking

The overlay and the content read `--ip-nested-level` and `--ip-nested-count`, which the primitive sets when dialogs open on top of one another. A nested alert dialog's overlay renders transparent instead of darkening the page a second time, and the dialog underneath scales back and shifts up so the stack stays legible.

## API Reference

Every prop the styling does not consume is forwarded to the [Alert Dialog primitive](/primitives/docs/alert-dialog), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-alert-dialog"></div>
