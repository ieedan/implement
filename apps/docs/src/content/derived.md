---
title: Derived & Watch
description: Compute read-only values from other signals, and run effects when signals change.
order: 5
---

## derived

`derived(signals, getter)` creates a read-only value computed from one or more sources. The getter receives the current value of each source, in order:

```ts
import { derived, signal } from "@implementjs/core";

const first = signal("Ada");
const last = signal("Lovelace");

const full = derived([first, last], (f, l) => `${f} ${l}`);

full.get(); // "Ada Lovelace"
```

Dependencies are **explicit** — the array lists exactly what the value recomputes from. There is no auto-tracking and therefore no accidental dependencies: the getter is a pure function of its arguments.

A derived value is a `Readable`, so it plugs in anywhere a signal does:

```ts
Button({ disabled: derived([title], (t) => t.trim() === "") }, "Save");
```

### Laziness and disposal

A `Derived` only subscribes to its sources while it has subscribers of its own. Mounted in the DOM it is live and cached; unused, it holds no subscriptions (and `get()` recomputes on demand). This means creating deriveds inside per-row factories or short-lived components does not leak source subscriptions.

Two consequences worth knowing:

- Calling `get()` repeatedly on a derived that nothing subscribes to re-runs the getter each time. Keep getters cheap, and don't create promises or other side effects inside them — put a promise in a `signal` and swap it explicitly instead (see [Await](/docs/await)).
- `dispose()` permanently disconnects a derived: it unsubscribes from sources and drops its subscribers. Only needed when you hand a derived to long-lived code outside the tree.

### Chaining

Deriveds derive from deriveds; `readable.bind(selector)` is shorthand for a single-source derived (see [Bindings](/docs/bindings)):

```ts
const items = signal<Item[]>([]);
const open = derived([items], (list) => list.filter((i) => !i.done));
const count = open.bind((list) => list.length);
```

## watch

`watch(signals, effect)` runs the effect **immediately** with the current values, then again whenever any source changes. It returns an unsubscribe function:

```ts
import { watch } from "@implementjs/core";

const stop = watch([theme], (t) => {
	document.documentElement.dataset.theme = t;
});

stop();
```

Inside a component, scope the watcher to the component's lifetime by returning the unsubscribe from [`Implement.Lifecycle`](/docs/lifecycle)'s `onMount`:

```ts
Implement.Lifecycle({ onMount: () => watch([query], (q) => save(q)) }, SearchPanel());
```

To skip the initial run and react only to _changes_, use `onChange` (on any readable) instead — it also provides the previous value.
