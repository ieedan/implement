---
title: Avatar
description: Show a user image with an automatic fallback while it loads or when it fails.
section: Components
---

<div data-demo="avatar" data-demo-description="Three arrangements: an avatar loading a GitHub photo, one with a broken image URL falling back to initials, and an overlapping stack of three avatars."></div>

An avatar renders an image with a fallback for when the image is loading or unavailable. `Avatar` is the root, `AvatarImage` is the picture, and `AvatarFallback` is what shows until the image has actually loaded (initials, an icon, anything).

```ts
import { Avatar, AvatarFallback, AvatarImage } from "@implementjs/primitives";

Avatar(
	{},
	AvatarImage({ src: "https://github.com/ieedan.png", alt: "@ieedan" }),
	AvatarFallback({}, "AB"),
);
```

Each part takes a props object first and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Div`, `Img`, or `Span`.

## Loading status

The root tracks a loading status: `"loading"`, `"loaded"`, or `"error"`. The image is preloaded off-DOM, so the fallback stays visible until the browser has real pixels — no broken-image flash. The image is hidden until the status is `"loaded"`, and the fallback is hidden once it is.

If `src` is missing or the request fails, the status becomes `"error"` and the fallback simply stays.

Pass `onLoadingStatusChange` to observe it:

```ts
Avatar(
	{ onLoadingStatusChange: (status) => console.log(status) },
	AvatarImage({ src }),
	AvatarFallback({}, "AB"),
);
```

A reactive `src` re-runs the load: pass a signal and swapping the value puts the avatar back into `"loading"` until the new image resolves.

## Delaying the fallback swap

On a fast connection the fallback can flash for a frame before the image appears. `delayMs` waits that many milliseconds after the image loads before showing it:

```ts
Avatar({ delayMs: 600 }, AvatarImage({ src }), AvatarFallback({}, "AB"));
```

## Styling

Every part sets a `data-avatar-*` attribute so you can target it in CSS, and all three expose `data-status` with the current loading status:

```ts
Avatar(
	{ class: "relative flex size-8 shrink-0 overflow-hidden rounded-full" },
	AvatarImage({ src, class: "aspect-square size-full" }),
	AvatarFallback({ class: "flex size-full items-center justify-center bg-muted" }, "AB"),
);
```

Visibility is handled for you with inline `display`, so a `flex` class on the fallback is safe — it only applies while the fallback is actually shown.

## API Reference

<div data-api="avatar"></div>
