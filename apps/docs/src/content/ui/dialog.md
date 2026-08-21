---
title: Dialog
description: A modal window over the page, with a scrim behind it.
section: Components
---

<div data-demo="dialog" data-demo-description="An “Edit profile” button opening a modal dialog with a title, description, name, username, and role fields, and a save button; the page behind is dimmed by an overlay."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/dialog
```

jsrepo pulls `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/dialog.ts`. It imports `button` from the same directory, so install that too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="dialog"></div>

<div data-tabs-end></div>

## Usage

`DialogContent` is a centered panel that scales in; `DialogOverlay` is the scrim behind it. Both are `fixed`, so where you put them in the tree does not matter — though `DialogPortal` is there for when it does.

A close button in the top right corner is included. `showCloseButton: false` removes it, for a dialog that has to be answered through its own buttons — or use an [alert dialog](/ui/alert-dialog), which has no escape hatches at all.

```ts
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from "@/lib/components/ui/dialog";

Dialog(
	DialogTrigger({ variant: "outline" }, "Edit profile"),
	DialogOverlay(),
	DialogContent(
		DialogTitle("Edit profile"),
		DialogDescription("Make changes to your profile here."),
		DialogClose({ variant: "default" }, "Save changes"),
	),
);
```

## Nesting

<div data-demo="dialog-nested" data-demo-description="A Share dialog listing who has access, with an Invite button that opens a nested dialog to send an email invite; the parent scales back in the stack and returns when Invite closes."></div>

Dialogs stack. The primitive counts the depth into `--ip-nested-level` and `--ip-nested-count`, and the styled classes spend them: the panel underneath scales back and shifts up, and the second overlay renders transparent rather than darkening the page twice.

Nothing to configure — open a dialog from inside a dialog and the stack behaves.

## Controlling it

Pass `open` as a signal to drive the dialog from outside, with or without a trigger:

```ts
const open = signal(false);

Dialog({ open }, DialogOverlay(), DialogContent(DialogTitle("Saved")));
```

## API Reference

Every prop the styling does not consume is forwarded to the [Dialog primitive](/primitives/docs/dialog), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-dialog"></div>
