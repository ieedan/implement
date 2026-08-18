---
title: Derived & Watch
description: Compute read-only values from other signals, and run effects when signals change.
section: Reactivity
order: 5
---

## derived

Sometimes you need to compute a value based on other values. `derived(signals, getter)` creates a read-only value computed from one or more sources. The getter receives the current value of each source, in order:

```ts
import { derived, signal } from "@implementjs/core";

const first = signal("Ada");
const last = signal("Lovelace");

const full = derived([first, last], (f, l) => `${f} ${l}`);

full.get(); // "Ada Lovelace"
```

Dependencies are **explicit**. The array lists exactly what the value recomputes from, so there is no auto-tracking and no accidental dependencies. The getter is a pure function of its arguments.

A derived value is a `Readable`, so it plugs in anywhere a signal does:

```ts
Button({ disabled: derived([title], (t) => t.trim() === "") }, "Save");
```

### Laziness and disposal

A `Derived` only subscribes to its sources while it has subscribers of its own. Mounted in the DOM it is live and cached. Unused, it holds no subscriptions and `get()` recomputes on demand. This means creating deriveds inside per-row factories or short-lived components does not leak source subscriptions.

Two consequences worth knowing:

- Calling `get()` repeatedly on a derived that nothing subscribes to re-runs the getter each time. Keep getters cheap, and don't create promises or other side effects inside them. Put a promise in a `signal` and swap it explicitly instead (see [Await](/docs/await)).
- `dispose()` permanently disconnects a derived. It unsubscribes from sources and drops its subscribers. You only need it when you hand a derived to long-lived code outside the tree.

### Chaining

Deriveds can derive from other deriveds, and `readable.bind(selector)` is shorthand for a single-source derived (see [Bindings](/docs/bindings)):

```ts
const items = signal<Item[]>([]);
const open = derived([items], (list) => list.filter((i) => !i.done));
const count = open.bind((list) => list.length);
```

## watch

Sometimes you will want a signal change to run a side effect instead of computing a value. For example saving to `localStorage` or setting an attribute on `document`. For this you can use the `Implement.Watch` component.

`Implement.Watch(signals, effect)` runs the effect **immediately** with the current values, then again whenever any of the sources change. It subscribes when it mounts and unsubscribes when it unmounts so you don't have to clean anything up yourself:

```ts
import { Implement } from "@implementjs/core";

Div(
	Implement.Watch([query], (q) => localStorage.setItem("q", q)),
	SearchPanel(),
);
```

Like `Implement.Window` it renders nothing and follows its position in the tree. If you place it inside an [`If`](/docs/if) branch the effect runs while the branch is shown and stops when it hides.

If you need to watch signals outside of the tree (stores, tests, etc.) you can use the `watch()` function. It works the same way but returns an unsubscribe function that you will need to call yourself:

```ts
import { watch } from "@implementjs/core";

const stop = watch([theme], (t) => {
	document.documentElement.dataset.theme = t;
});

stop();
```

If you want to skip the initial run and react only to changes, use `onChange` (available on any readable) instead. It also provides the previous value.

Deriving a whole new value is one way to get a focused view of your state. The other is [bindings](/docs/bindings), which let you zoom into a piece of an existing signal.
