---
title: Error Boundaries
description: Catch errors from a subtree's mount and reactive updates, render a fallback, and retry.
section: Composition
order: 14
---

Things break, and when they do you don't want one error taking down the whole app. `ImplementBoundary` isolates failures. When something in its subtree throws, the boundary swaps in its `Catch` branch instead of letting the error propagate.

```ts
import { ImplementBoundary, ImplementEffect } from "@implementjs/core";

ImplementBoundary(IssuePage(id)).Catch((error, reset) =>
	Div(P(error.message), Button({ onClick: reset }, "Retry")),
);
```

`reset` remounts the original children from scratch. Without a `Catch`, an error renders nothing in place of the subtree.

## What a boundary catches

- Errors thrown **synchronously while the subtree mounts**, including a component function throwing while building its tree.
- Errors raised **during reactive updates** inside the structural helpers. [`If`](/docs/if), [`ForEach`](/docs/foreach), [`Switch`](/docs/switch), [`Key`](/docs/key), [`Await`](/docs/await), and [`Portal`](/docs/portal) all route their signal-driven re-syncs to the nearest boundary. A `ForEach` key error or a render function throwing on update lands here.
- Errors thrown in [`Lifecycle.onMount`](/docs/lifecycle) and in [`ImplementEffect`](/docs/derived) effects.

Thrown values that aren't `Error`s are normalized into one.

## What it deliberately does not catch

- **Event handler errors.** Wrap handler bodies in `try`/`catch` yourself.
- **Promise rejections.** Those belong to [`Await.Catch`](/docs/await).
- A derived getter that throws when called _outside_ any reactive sync (a plain `.get()` in your own code) propagates to the caller as usual.

## Behavior details

- Boundaries **nest**. An error goes to the nearest one at or above where it was raised. If the `Catch` branch itself throws, the error escalates to the next boundary up rather than looping. With no boundary above, it rethrows.
- The swap to the `Catch` branch is deferred a microtask (still before paint), so an error raised mid-mount never re-enters a mount pass already on the stack.
- Boundaries follow the **logical tree**, so a failing subtree inside a `Portal` still reaches the boundary that wraps the portal.

## Placement

Put boundaries where a failure has a sensible replacement UI. Around a route's page, a widget, a row. Not one giant boundary at the root:

```ts
const router = Router({
	"/issues": {
		layout: (child) => Shell(ImplementBoundary(child).Catch(PageError)),
		"/": () => Issues(),
		"/:id": { "/": ({ id }) => Issue(id) },
	},
});
```

One more composition tool to go. Sometimes the right DOM parent for a component isn't where it lives in your tree, and for that there's [Portal](/docs/portal).
