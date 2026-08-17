---
title: Key
description: Force a full remount of a subtree whenever a signal changes.
order: 10
---

`Key(signal, ...children)` unmounts and remounts its children from scratch every time the watched signal (or any signal in an array of them) changes.

```ts
import { Key } from "@packages/implement";

Key(route, PageFor(route));
Key([route, user], PageFor(route, user));
```

## When to reach for it

Most of the framework updates _in place_: signals patch text and props, [`ForEach`](/docs/foreach) patches row signals, the [router](/docs/router) patches param signals on same-route navigation. That is usually what you want — but sometimes a fresh instance is the point:

- **Reset local state.** A form component seeds `signal(initialValue)`s once when it is created. Wrapping it in `Key(recordId, ...)` gives you a clean form per record.
- **Re-run setup.** [`Lifecycle.onMount`](/docs/lifecycle) hooks, subscriptions, and focus logic run again on every remount.
- **Restart media/animations.** A remounted `Video` or CSS animation starts over.

```ts
// a fresh editor (fresh draft state) each time the selected issue changes
Key(issueId, IssueEditor(issueId));
```

## Notes

- `Key` does not unwrap or transform the signal — children close over reactive values themselves. It only listens and remounts.
- Because children are torn down completely, everything inside loses state on each change: uncommitted input, scroll position, subscriptions. Use it deliberately.
- For keyed identity _per list item_, use `ForEach`'s key function instead; `Key` is for a single subtree keyed on a value.
