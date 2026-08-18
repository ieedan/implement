---
title: Updating the DOM
description: Change a signal and only the subscribed nodes update.
section: Signals
order: 3
---

The component function does not run again when state changes. The button's click handler writes to the signal, and the text node that received `count` updates itself.

Signals include helpers for common writes:

```ts
count.increment();
count.decrement();
open.toggle();
```

`count.increment()` is the same as `count.update((n) => n + 1)`.

Wire the button so each click increments `count`. The heading should keep showing the live value.
