---
title: Computed values
description: Derive a read-only value from other signals.
section: Derived
order: 5
---

`derived(signals, getter)` computes a read-only value from one or more sources. The getter receives each source's current value, in order. Dependencies are explicit: only the signals in the array can change the result.

```ts
const doubled = derived([count], (n) => n * 2);
```

A derived value is a `Readable`, so you can pass it anywhere a signal works.

Keep the increment button, and show both the count and its double.
