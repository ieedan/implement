---
title: Card
description: A bordered surface holding one piece of the page.
section: Components
---

<div data-demo="card" data-demo-description="A sign-in card: title, description, a Sign up link in the top right, email and password fields, and a full-width Sign in button."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/card
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/card.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too.

<div data-source="card"></div>

<div data-tabs-end></div>

## Usage

```ts
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/lib/components/ui/card";

Card(
	CardHeader(CardTitle("Sign in"), CardDescription("Use the email you signed up with.")),
	CardContent(Form()),
	CardFooter(Button({ class: "flex-1" }, "Sign in")),
);
```

## The header is a grid

`CardHeader` is a grid rather than a flex row, and it grows a second column only when a `CardAction` is present (`has-data-[slot=card-action]`). That way a control in the top right does not force the title and description to know about it:

```ts
CardHeader(
	CardTitle("Sign in"),
	CardDescription("Use the email you signed up with."),
	CardAction(Button({ variant: "link", size: "sm" }, "Sign up")),
);
```

## Borders on the header and footer

Add `border-b` to the header or `border-t` to the footer and the padding adjusts itself — the components watch for those classes (`[.border-b]:pb-6`) rather than making you add the padding too.

## API Reference

<div data-api="ui-card"></div>
