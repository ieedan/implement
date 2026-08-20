---
title: Lifecycle
description: Hook into mount and unmount at a position in the tree — focus, measure, and scope subscriptions.
section: Composition
order: 13
---

Sometimes you need to run code when part of your UI appears or disappears. `Implement.Lifecycle` runs hooks when its position in the tree mounts and unmounts. Standalone it renders nothing and tracks its own lifecycle. Given children it owns them, so the hooks fire with the wrapped subtree's lifecycle.

```ts
import { Implement } from "@implementjs/core";

// standalone: focus the dialog's input once it's on screen
Implement.Lifecycle({
	onMount: (parent) => parent.querySelector("input")?.focus(),
});

// wrapping: hooks tied to IssueView's mounted lifetime
Implement.Lifecycle(
	{ onMount: () => id.onChange(refetch) }, // returns the unsubscribe
	IssueView(id),
);
```

## onMount

`onMount(parent)` runs **after the mount pass finishes**, once the subtree is connected to the document, so measuring layout and moving focus are safe. It receives the parent element it mounted into.

Return a cleanup function and it runs on unmount. This is the idiom for scoping anything with an unsubscribe to the component's lifetime:

```ts
Implement.Lifecycle({
	onMount: () => {
		const stop = query.onChange(refetch);
		const timer = setInterval(tick, 1000);
		return () => {
			stop();
			clearInterval(timer);
		};
	},
});
```

Since `subscribe` and `onChange` return their unsubscribe function, single-subscription cases collapse to `onMount: () => query.onChange(refetch)`. If all you want to do is watch some signals you don't need `Lifecycle` at all, use [`Implement.Watch`](/docs/derived) and it will clean up after itself.

## onUnmount

`onUnmount()` runs synchronously at the start of unmount, **while the children are still in the DOM**. It's the place to read final state or hand off measurements before teardown. After that the `onMount` cleanup (if any) runs, then children unmount.

## onExit

`onExit(signal)` runs when the subtree is _leaving_, before anything is removed. Return a promise and removal waits for it — the nodes stay on screen and the subtree stays live — which is what makes exit animations possible:

```ts
Implement.Lifecycle({
	onExit: () => animate(panel.get()!, { opacity: 0, y: 8 }, { duration: 0.2 }),
});
```

Anything that removes the subtree waits: an `If` hiding a branch, a `ForEach` dropping a row, a `Key` swapping instances, a route changing, or any ancestor above it going away. The incoming content mounts immediately rather than waiting for the exit, so the two overlap — a leaving branch renders before the one replacing it, and a leaving row keeps its slot in the list until it's gone.

`signal` is an `AbortSignal` that fires when the exit is cancelled, which happens when the subtree comes back (a `ForEach` key re-added before its row finished leaving) or when the tree is being torn down and can't wait. Stop what you started:

```ts
Implement.Lifecycle({
	onExit: (signal) => {
		const animation = animate(row.get()!, { opacity: 0 }, { duration: 0.3 });
		signal.addEventListener("abort", () => animation.stop());
		return animation;
	},
});
```

A cancelled exit leaves the subtree mounted exactly as it was — it was never torn down, so nothing re-renders and no state is lost.

Two things to keep in mind. The subtree is still subscribed while it leaves, so bindings reading outer signals keep updating during the animation; snapshot anything that should freeze. And a hook that never settles keeps its nodes on screen forever, so give animations a duration rather than waiting on something open-ended.

Like `onMount`, `onExit` is a no-op during a server render.

## What triggers the hooks

The hooks track this node's own mount and unmount only:

- Mounted inside an [`If`](/docs/if)/[`Switch`](/docs/switch) branch they fire each time the branch shows and hides.
- Inside a [`ForEach`](/docs/foreach) row they fire when the row is added and removed, not when it reorders.
- Wrapped children toggling _their own_ internal branches does not re-fire the hooks.
- [`Key`](/docs/key) remounts everything beneath it, so hooks under a `Key` re-fire on every key change.

Errors thrown in `onMount` route to the nearest [error boundary](/docs/boundary), and error boundaries are exactly where we're headed next.
