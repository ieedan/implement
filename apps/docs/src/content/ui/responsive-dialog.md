---
title: Responsive Dialog
description: One modal that is a dialog on a desktop and a drawer on a phone.
section: Components
---

<div data-demo="responsive-dialog" data-demo-description="An “Edit profile” button that opens a centered dialog on a wide window and a bottom drawer on a narrow one, with the same title, description, name and username fields, and save button in both."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/responsive-dialog
```

jsrepo pulls [`dialog`](/ui/dialog), [`drawer`](/ui/drawer), and `button` along with it, and installs `@implementjs/lucide`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/responsive-dialog.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`dialog`](/ui/dialog), [`drawer`](/ui/drawer) and `button` from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="responsive-dialog"></div>

<div data-tabs-end></div>

## Usage

Write it once. Below 768px it is a [drawer](/ui/drawer) up from the bottom edge, draggable and dismissable with a thumb; above it, a centered [dialog](/ui/dialog).

```ts
import {
	ResponsiveDialog,
	ResponsiveDialogClose,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogTitle,
	ResponsiveDialogTrigger,
} from "@/lib/components/ui/responsive-dialog";

ResponsiveDialog(
	ResponsiveDialogTrigger("Edit profile"),
	ResponsiveDialogContent(
		ResponsiveDialogTitle("Edit profile"),
		ResponsiveDialogDescription("Make changes to your profile here."),
		ResponsiveDialogClose({ variant: "default" }, "Save changes"),
	),
);
```

The panel has no padding of its own, because the two shapes want different padding: a drawer wants room for a thumb at the bottom, a dialog does not. A `sm:` prefix is enough, since the breakpoint is the same one Tailwind's `sm` uses.

```ts
ResponsiveDialogContent(
	Div({ class: "mx-auto flex w-full max-w-sm flex-col gap-6 p-4 pb-8 sm:p-0" }, …),
);
```

## How it switches

The root reads [`mediaQuery`](/docs/media-query) once and renders either a `Drawer` or a `Dialog` around your children. Both shapes share one `open` signal, so a drawer left open on a phone that becomes a tablet comes back as an open dialog rather than nothing at all.

Only the root and the panel differ. `ResponsiveDialogTitle`, `ResponsiveDialogDescription`, and `ResponsiveDialogClose` are one component each: `Drawer` and `Dialog` are the [same modal primitive](/primitives/docs/drawer) underneath, so a title resolves against whichever root it finds itself in and picks up that root's data attributes.

Pass `query` to move the breakpoint:

```ts
ResponsiveDialog({ query: "(max-width: 1023px)" }, …);
```

## Props reach the shape they belong to

`ResponsiveDialogContent` takes the panel props of both. `showHandle` and the drawer's other content props reach the drawer; `showCloseButton` reaches either. Root props work the same way — `snapPoints`, `direction`, and `dismissible` reach the drawer, and `preventScroll` reaches both.

```ts
ResponsiveDialog(
	{ snapPoints: [0.5, 1] },
	ResponsiveDialogTrigger("Filters"),
	ResponsiveDialogContent(ResponsiveDialogTitle("Filters"), …),
);
```

A prop the current shape does not have is simply not used, so there is nothing to guard.

## Controlling it

Pass `open` as a signal to drive it from outside, with or without a trigger. The signal survives the switch between shapes:

```ts
const open = signal(false);

ResponsiveDialog({ open }, ResponsiveDialogContent(ResponsiveDialogTitle("Saved")));
```

## API Reference

<div data-api="ui-responsive-dialog"></div>
