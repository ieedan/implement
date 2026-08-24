---
title: Button
description: The button, and the variant table half the registry borrows.
section: Components
---

<div data-demo="button" data-demo-description="A row of buttons in every variant and a few sizes: default, secondary, outline, ghost, destructive, link, one with an icon, an icon-only button, and a disabled one."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/button
```

It installs `tailwind-variants` and the [spinner](/ui/spinner) at the same time — the spinner is what a loading button renders.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/button.ts`. It imports `cn` and the spinner, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` and [`spinner.ts`](/ui/spinner) to `src/lib/components/ui/spinner.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants @implementjs/lucide
```

<div data-source="button"></div>

<div data-tabs-end></div>

## Usage

`buttonVariants` is the part that travels. A dialog trigger, a popover close, the calendar's arrows, a toast action — none of them are `Button`, but all of them render through this table, which is why one edit here restyles the whole registry.

```ts
import { Button, buttonVariants } from "@/lib/components/ui/button";

Button({ variant: "outline", size: "sm" }, "Save");

// the same styles on something that is not a button
A({ href: "/docs", class: buttonVariants({ variant: "link" }) }, "Read the docs");
```

## Icons

An icon in a button is sized and made non-interactive by the base styles, so it needs no classes of its own. Give an icon-only button an `aria-label` — there is no text to name it:

```ts
Button({ size: "icon", "aria-label": "Add" }, PlusIcon({ "aria-hidden": true }));
```

`has-[>svg]` trims the horizontal padding when a button holds both an icon and a label, so the pair stays optically centered.

## Loading

`loading` puts a [spinner](/ui/spinner) in the button and stops it accepting clicks. It takes a signal, so the state can live wherever the work does:

<div data-demo="button-loading" data-demo-description="Four buttons: Save, which loads for two seconds when clicked; an outline Publish driven by a signal the demo flips itself; an icon-only refresh button whose icon is replaced by a spinner while it loads; and one left loading forever."></div>

```ts
const saving = signal(false);

Button({ loading: saving }, "Save");
Button({ loading: true }, "Saving"); // a fixed state is fine too
```

A loading button is disabled while it loads, and carries `data-loading` and `aria-busy` for anything styling or announcing around it.

An icon button is one square with no room beside its icon, so there the spinner takes the icon's place rather than crowding in next to it. Every other size keeps its label and puts the spinner before it.

## Awaiting a click

Most loading states last exactly as long as one async click, so `onClickPromise` writes that case for you: the button loads until the promise the handler returns settles.

```ts
Button({ onClickPromise: () => save(draft) }, "Save");
```

The promise is not swallowed — a rejection reaches your own `catch`, or the console, exactly as it would have without the button in the way. Handle failures where you would handle them anyway:

```ts
Button(
	{
		onClickPromise: async () => {
			try {
				await save(draft);
			} catch (error) {
				console.error(error);
			}
		},
	},
	"Save",
);
```

A handler that returns something other than a promise never enters the loading state, `onClick` still runs first when both are passed, and `loading` still wins on its own — the two states are ORed, so a button can be loading for a reason that has nothing to do with its last click.

## Overriding

`class` is merged with the variant table, not appended to it, so a utility you pass wins over the one the variant baked in:

```ts
Button({ size: "icon", class: "size-20" }); // 20, not 9
Button({ variant: "outline", class: "border-destructive" });
```

That holds for every component in the registry — see [Merging classes](/ui#merging-classes).

## Variants elsewhere

`ButtonVariant` and `ButtonSize` are exported as types. Components that put a button somewhere accept them by those names — `DialogTrigger({ variant: "destructive" })` reaches the same table.

## API Reference

<div data-api="ui-button"></div>
