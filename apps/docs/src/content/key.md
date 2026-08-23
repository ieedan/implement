---
title: Key
description: Force a full remount of a subtree whenever a signal changes.
section: Control flow
order: 11
---

`Key(signal, ...children)` unmounts and remounts its children from scratch every time the watched signal (or any signal in an array of them) changes.

```ts
import { Key } from "@implementjs/core";

Key(route, PageFor(route));
Key([route, user], PageFor(route, user));
```

## When to reach for it

Most of the framework updates _in place_. Signals patch text and props, [`ForEach`](/docs/foreach) patches row signals, and the [router](/docs/router) patches param signals on same-route navigation. Usually that's exactly what you want, but sometimes a fresh instance is the point:

- **Resetting local state.** A form component seeds its `signal(initialValue)`s once when it is created. Wrapping it in `Key(recordId, ...)` gives you a clean form per record.
- **Re-running setup.** [`Lifecycle.onMount`](/docs/lifecycle) hooks, subscriptions, and focus logic run again on every remount.
- **Restarting media or animations.** A remounted `Video` or CSS animation starts over.

```ts
// a fresh editor (fresh draft state) each time the selected issue changes
Key(issueId, IssueEditor(issueId));
```

## Notes

- `Key` does not unwrap or transform the signal. Children close over reactive values themselves, `Key` only listens and remounts.
- Because children are torn down completely, everything inside loses state on each change. Uncommitted input, scroll position, subscriptions. Use it deliberately.
- For keyed identity _per list item_ use `ForEach`'s key function instead. `Key` is for a single subtree keyed on a value.

`Key` remounts children you wrote out ahead of time. When the node itself comes out of a signal, that's [Dynamic](/docs/dynamic).
