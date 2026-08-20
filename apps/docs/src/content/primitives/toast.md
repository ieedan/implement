---
title: Toast
description: Briefly announce the result of an action in a stack of self-dismissing messages.
section: Components
---

<div data-demo="toast" data-demo-description="A row of buttons (Show toast, Success, Error, With action, Promise) that push styled notifications into a stack in the bottom-right corner of the screen; hovering the stack fans it out, and toasts can be swiped away."></div>

A toast is a short message that appears, waits, and leaves on its own. The pieces are split the same way as [Base UI's Toast](https://base-ui.com/react/components/toast): a manager owns the list and the clocks, `ToastProvider` shares it, `ToastViewport` is the region the stack lives in, and `Toast` renders one message with `ToastTitle`, `ToastDescription`, `ToastAction`, and `ToastClose` inside it.

```ts
import { ForEach } from "@implementjs/core";
import {
	createToastManager,
	Toast,
	ToastClose,
	ToastDescription,
	ToastPortal,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@implementjs/primitives";

const manager = createToastManager();

ToastProvider(
	{ manager },
	ToastPortal(
		ToastViewport(
			{},
			ForEach(
				manager.toasts,
				(t) => t.id,
				(toast) =>
					Toast(
						{ toast },
						ToastTitle({}, toast.bind((t) => t.title ?? "")),
						ToastDescription({}, toast.bind((t) => t.description ?? "")),
						ToastClose({}, "Close"),
					),
			),
		),
	),
);

manager.add({ title: "Event created", description: "Friday at 4:00 PM" });
```

Unlike the other primitives, toasts are created imperatively: the tree above mounts once, and `manager.add` is called from wherever something worth announcing happens.

## The manager

`createToastManager()` returns the object that owns everything: `toasts` is a [signal](/docs/signals) holding the list (frontmost first), and `add`, `update`, `close`, `remove`, and `promise` change it. Create it at module scope so any code can import it and push a message; the tree renders whatever the manager holds.

```ts
const id = manager.add({
	title: "Message archived",
	description: "It moved to the Archive folder.",
	type: "success",
	timeout: 8000,
});

manager.update(id, { title: "Two messages archived" });
manager.close(id);
manager.close(); // close everything
```

`add` returns the toast's id. Passing an existing `id` to `add` updates that toast in place instead of stacking a duplicate — useful for progress that keeps replacing itself. `update` also restarts the toast's clock so the new content gets a full stay. `close` starts the exit; the toast leaves the list once its exit transition finishes (see [Animation](#animation)).

Everything you pass to `add` rides along on the toast object: `type` becomes `data-type` on every part for styling, `priority: "high"` makes screen readers announce it assertively, and `data` carries anything your render function needs — an icon, a payload, an action callback. `onClose` fires when the toast starts leaving, `onRemove` when it is gone.

## Timers

Each toast dismisses itself after `timeout` milliseconds — its own, or the default from the provider or manager (5000). `timeout: 0` keeps a toast until it is closed explicitly.

The clocks pause while the pointer is over the stack, while the stack holds keyboard focus, and while the window is blurred or the tab hidden — a toast never quietly expires while it is being read or nobody is looking. `manager.pause()` and `manager.resume()` do the same by hand.

At most `limit` toasts (default 3) are visible at once. Extra toasts stay in the list marked `data-limited` — hide them in CSS — and their clocks hold until they surface.

## Promises

`manager.promise` covers the common async flow: it shows a loading toast (with `type: "loading"` and no timeout), then updates it into the success or error state when the promise settles. Each state takes a string, an options object, or a function of the resolved value:

```ts
manager.promise(saveDocument(), {
	loading: "Saving…",
	success: (doc) => `${doc.name} saved`,
	error: { title: "Could not save", description: "Check your connection." },
});
```

The promise is returned unchanged, so errors still reach your own handling.

## The viewport and stacking

`ToastViewport` is a `role="region"` landmark. Position it yourself (`fixed bottom-6 right-6` in the demo) — the primitive does not choose a corner. Pressing <kbd>F6</kbd> (or the provider's `hotkey`) moves focus into it so keyboard users can reach the stack; each toast is focusable, and <kbd>Escape</kbd> on one dismisses it.

Hovering or focusing the viewport sets `data-expanded` on the viewport and every toast. Each `Toast` measures itself and exposes the stacking math as CSS variables, so collapsed and expanded layouts are pure CSS:

- `--toast-index` — position from the front (`0` is frontmost)
- `--toast-offset-y` — distance in px to this toast's expanded slot, from real heights plus the provider's `gap`
- `--toast-height` and `--toast-frontmost-height` — measured heights

`data-behind` marks every toast that is not frontmost.

## Swipe to dismiss

Toasts can be flicked away with a pointer. `swipeDirection` on `Toast` picks the allowed direction(s) — the default `["down", "right"]` suits a bottom-right stack. While a drag is in flight the root has `data-swiping` and writes `--toast-swipe-movement-x` / `--toast-swipe-movement-y`; feed those into the transform so the toast follows the pointer 1:1 (and disable transitions under `data-swiping`). Past 45px the toast dismisses with `data-swipe-direction` left on it for a directional exit; short of that it springs back. Buttons, links, inputs, and anything under `[data-swipe-ignore]` never start a swipe.

## Animation

A toast's element mounts when it is added, so entrances use `@starting-style` (the `starting:` variant), exactly like a freshly-mounted dialog. Exits are the reverse trick: `close` flips `data-state` to `"closed"` but keeps the toast in the list while your closing styles transition, removing it only after the longest transition or animation on the root finishes. No transition means instant removal.

```ts
Toast({
	toast,
	class:
		"transition-[transform,opacity] duration-300 " +
		"starting:data-[state=open]:opacity-0 data-[state=closed]:opacity-0",
});
```

The demo drives its whole stack from one `transform` that reads the CSS variables above, so entering, stacking, expanding, swiping, and leaving all share a single declaration — the states only swap variable values. Open the demo's source to see the full set of classes.

## API Reference

<div data-api="toast"></div>
