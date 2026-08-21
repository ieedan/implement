---
title: Avatar
description: A user's photo, with initials to fall back on.
section: Components
---

<div data-demo="avatar" data-demo-description="Three arrangements: an avatar loading a GitHub photo, one with a broken image URL falling back to initials, and an overlapping stack of three avatars."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/avatar
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/avatar.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too.

<div data-source="avatar"></div>

<div data-tabs-end></div>

## Usage

`Avatar` is a 2rem circle that clips whatever is inside it. `AvatarImage` fills it, and `AvatarFallback` takes over when the image is still loading or has failed — the primitive tracks the load, so there is no flash of initials behind a photo that arrives.

```ts
import { Avatar, AvatarFallback, AvatarImage } from "@/lib/components/ui/avatar";

Avatar(AvatarImage({ src: "https://github.com/ieedan.png", alt: "@ieedan" }), AvatarFallback("AB"));
```

## Sizing and stacking

Size is a class on the root, and the parts follow it:

```ts
Avatar({ class: "size-12" }, AvatarImage({ src, alt: "" }), AvatarFallback("AB"));
```

For an overlapping row, give the group a negative gap and ring each avatar in the page background so the edges stay readable:

```ts
Div(
	{ class: "flex -space-x-2" },
	Avatar({ class: "ring-2 ring-background" }, AvatarFallback("AB")),
	Avatar({ class: "ring-2 ring-background" }, AvatarFallback("CD")),
);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Avatar primitive](/primitives/docs/avatar), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-avatar"></div>
