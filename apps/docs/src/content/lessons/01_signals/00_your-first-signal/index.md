---
title: Your first signal
description: Store a value that the DOM can subscribe to.
section: Signals
order: 2
---

A signal holds a value and notifies anyone reading it when that value changes.

```ts
const count = signal(0);

count.get(); // 0
count.set(5);
```

Anywhere implement accepts a string or number, it also accepts a signal. Pass `count` as a child and the text node stays in sync.

Replace the static `0` with a signal and render the signal itself next to the label.
