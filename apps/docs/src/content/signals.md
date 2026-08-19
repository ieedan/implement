---
title: Signals
description: Writable reactive values with get, set, update, and a toolbox of convenience methods.
section: Reactivity
order: 4
---

Signals are how implement components update themselves when something in your app changes. A signal is a container for a value that notifies subscribers when the value changes.

```ts
import { signal } from "@implementjs/core";

const count = signal(0);

count.get(); // 0
count.set(5); // notify subscribers
count.update((n) => n + 1); // set via the current value
```

Anywhere the framework accepts a value (a prop, a text child, a condition) it also accepts a signal, and the DOM stays in sync. You will almost never subscribe by hand. You just hand signals to elements and helpers.

## Signals in the DOM

This is where the elements you learned in the last part come alive. Pass a signal as a **text child** and you get a live text node. Pass one as a **prop** and the attribute updates when it changes:

```ts
const count = signal(0);
const disabled = signal(true);

P("Count: ", count);
Button({ disabled, onClick: () => count.increment() }, "Increment");
```

`class` and `style` values can be signals anywhere a value fits, and the class list re-resolves when any of them change:

```ts
Div({ class: ["btn", { active: isActive }] }); // isActive: Signal<boolean>
Div({ style: { color: textColor } });
```

Event handler props can be signals of functions too, and the listener is swapped when they change.

### Two-way form bindings

A few props are two-way. Pass a **writable** signal and the framework both applies the signal to the DOM and writes user input back into the signal.

| Element                  | Prop      | DOM event |
| ------------------------ | --------- | --------- |
| `Input`, `Textarea`      | `value`   | `input`   |
| `Select`                 | `value`   | `change`  |
| `Input` (checkbox/radio) | `checked` | `change`  |
| `Details`, `Dialog`      | `open`    | `toggle`  |

```ts
const title = signal("");
const done = signal(false);

Input({ value: title, placeholder: "Title" });
Input({ type: "checkbox", checked: done });
```

Passing a read-only `Readable` (or a plain value) makes the same props one-way. `Select` re-applies `value` after its options mount, so an initial value always finds its `Option`.

## Readable and Writable

Two interfaces describe what you can do with a signal:

- `Readable<T>` has `get()`, `subscribe(cb)`, `onChange(cb)`, and `bind(...)`.
- `Writable<T>` has everything above plus `set(value)` and `flush()`.

`signal()` returns a `Signal<T>` (writable). [`derived`](/docs/derived) returns a read-only value. Accepting `Readable<T>` in your component signatures lets callers pass either.

If you want to write your own "plain value or signal" APIs the guards `isReadable(value)` and `isWritable(value)` are exported for exactly that:

```ts
import { isReadable, type Readable } from "@implementjs/core";

function Price(amount: number | Readable<number>) {
	const text = isReadable(amount) ? amount.bind((a) => format(a)) : format(amount);
	return Span(text);
}
```

## Convenience methods

Working with signals with just `.set()` and `.update()` isn't the best experience, so `Signal` ships typed helpers that only appear when the value's type allows them:

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

`set` compares the old and new value with **deep equality** and does nothing when they are equal. Setting a structurally identical object does not cause any DOM work:

```ts
const user = signal({ name: "Ada" });
user.set({ name: "Ada" }); // no notification
```

There are three exceptions that compare by reference only, because deep equality would treat them as always-equal empty objects: `Map`, `Set`, and promises/thenables. A new `Map`, `Set`, or promise instance always notifies (which is what lets [`Await`](/docs/await) re-follow a promise swapped into a signal).

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

If you want to run an effect now and on every change use [`Implement.Watch`](/docs/derived). It subscribes when it mounts and cleans up after itself when it unmounts. Outside of the tree you can use the [`watch`](/docs/derived) function which returns its unsubscribe function.

> [!TIP]
> If you subscribe inside a component, tie the subscription to the component's lifetime with [`Implement.Lifecycle`](/docs/lifecycle) so it is cleaned up on unmount.

## Element references

The `this` prop binds the mounted DOM node into a `Ref`, a `Signal<T | null>` that starts as `null`:

```ts
import { ref } from "@implementjs/core";

const input = ref<HTMLInputElement>();

Div(Input({ this: input }), Button({ onClick: () => input.get()?.focus() }, "Focus"));
```

The ref is written right after the node is appended to its parent and set back to `null` on unmount.

> [!NOTE]
> The node may not be connected to the document yet when the ref is written, because ancestors append after children. To measure or focus once everything is connected use [`Implement.Lifecycle`](/docs/lifecycle).

You can update the DOM from state now, but real apps also need values computed from other values. That's [derived](/docs/derived), up next.
