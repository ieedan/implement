---
title: Signal basics
description: How to create, update, and read signals.
section: Signals
---

Signals are how implement components update themselves when something in your app changes.

You create signals by calling the `signal()` function:

```ts
const count = signal(0);
```

The most basic way to update signals is to use the `.set()` and `.update()` methods:

```ts
const count = signal(0);

count.set(2);
count.get(); // count = 2
count.update((prev) => prev + 1);
count.get(); // count = 3
```

As you see above you can get the value of a signal by calling `.get()`. While this will reliably give you the current value of the signal at the time of calling `.get()` is not reactive so it's only appropriate to be used in your function bodies.

In the next lesson we will show you how to update the dom but for now why don't you add a signal to this component.
