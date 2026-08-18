---
title: Signals
description: Writable reactive values with get, set, update, and a toolbox of convenience methods.
order: 4
---

A signal is a container for a value that notifies subscribers when the value changes.

```ts
import { signal } from "@implementjs/core";

const count = signal(0);

count.get(); // 0
count.set(5); // notify subscribers
count.update((n) => n + 1); // set via the current value
```

Anywhere the framework accepts a value — a prop, a text child, a condition — it also accepts a signal, and the DOM stays in sync. You almost never subscribe by hand; you hand signals to elements and helpers.

## Readable and Writable

Two interfaces describe capability:

- `Readable<T>` — `get()`, `subscribe(cb)`, `onChange(cb)`, `bind(...)`.
- `Writable<T>` — everything above plus `set(value)` and `flush()`.

`signal()` returns a `Signal<T>` (writable). [`derived`](/docs/derived) returns a read-only value. Accepting `Readable<T>` in your component signatures lets callers pass either.

The guards `isReadable(value)` and `isWritable(value)` are exported for writing "plain value or signal" APIs of your own:

```ts
import { isReadable, type Readable } from "@implementjs/core";

function Price(amount: number | Readable<number>) {
	const text = isReadable(amount) ? amount.bind((a) => format(a)) : format(amount);
	return Span(text);
}
```

## Convenience methods

`Signal` ships typed helpers that only appear when the value's type allows them:

```ts
const open = signal(false);
open.toggle();

const count = signal(0);
count.increment(); // +1
count.increment(10); // +10
count.decrement();

const items = signal<string[]>([]);
items.push("a", "b"); // like Array#push, but immutably: sets a new array
items.pop();
items.unshift("first");
items.shift();
items.splice(1, 2, "replacement");
```

The array helpers mirror the `Array` methods (including return values) but always `set` a fresh array, so subscribers are notified.

## Equality: when does set notify?

`set` compares the old and new value with **deep equality** and does nothing when they are equal — setting a structurally identical object does not cause DOM work:

```ts
const user = signal({ name: "Ada" });
user.set({ name: "Ada" }); // no notification
```

Three exceptions compare by reference only, because deep-equal would treat them as always-equal empty objects: `Map`, `Set`, and promises/thenables. A new `Map`, `Set`, or promise instance always notifies (which is what lets [`Await`](/docs/await) re-follow a promise swapped into a signal).

## flush: notifying after in-place mutation

Because equality is checked in `set`, mutating the current value in place is invisible. Either set a copy, or mutate and call `flush()` to notify subscribers of the current value:

```ts
const items = signal<Item[]>([]);

// preferred: immutable update
items.update((list) => [...list, next]);

// escape hatch: in-place mutation
items.get().push(next);
items.flush();
```

## Subscribing manually

```ts
const unsubscribe = count.subscribe((value) => console.log(value));
unsubscribe();
```

`subscribe` fires on every change from then on (not immediately). `onChange` also skips the current value but hands you the previous one too:

```ts
id.onChange((next, previous) => refetch(next));
```

For "run now and on every change" over one or more signals, use [`watch`](/docs/derived). If you subscribe inside a component, tie the subscription to the component's lifetime with [`Implement.Lifecycle`](/docs/lifecycle) so it is cleaned up on unmount.

## Ref

`Ref<T>` is a `Signal<T | null>` that starts as `null` — made for element `this` bindings, but usable anywhere a nullable signal fits:

```ts
const el = new Ref<HTMLDialogElement>();
Dialog({ this: el });
el.get()?.showModal();
```

See [Elements & Props](/docs/elements) for the `this` prop's timing guarantees.
