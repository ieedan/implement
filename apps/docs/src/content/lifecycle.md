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

## What triggers the hooks

The hooks track this node's own mount and unmount only:

- Mounted inside an [`If`](/docs/if)/[`Switch`](/docs/switch) branch they fire each time the branch shows and hides.
- Inside a [`ForEach`](/docs/foreach) row they fire when the row is added and removed, not when it reorders.
- Wrapped children toggling _their own_ internal branches does not re-fire the hooks.
- [`Key`](/docs/key) remounts everything beneath it, so hooks under a `Key` re-fire on every key change.

Errors thrown in `onMount` route to the nearest [error boundary](/docs/boundary), and error boundaries are exactly where we're headed next.
