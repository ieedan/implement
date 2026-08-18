---
title: Bindings
description: Focused views into a signal's value with bind — by path or by selector, one-way or two-way.
section: Reactivity
order: 6
---

`bind` creates a smaller signal out of a bigger one. It comes in three shapes.

## Path bindings

Pass a (possibly dotted) key path to get a view of that field. On a **writable** source the view is writable too. Setting it writes an immutably-updated parent back into the source.

```ts
const todo = signal({
	title: "Ship docs",
	author: { name: "Ada" },
});

const title = todo.bind("title"); // Writable<string>
const author = todo.bind("author.name"); // Writable<string>

title.set("Ship v2");
// todo is now { title: "Ship v2", author: { name: "Ada" } } — a new object

Input({ value: title }); // two-way form binding through the path
```

Paths are fully typed, so `todo.bind("autor.name")` is a compile error. They walk through plain objects at any depth. Arrays, `Map`s, `Set`s, `Date`s, and functions are leaves, meaning you can bind _to_ them but not through them (index into arrays with a selector binding instead).

On a read-only source the same call returns a `Readable` of the path.

## Selector bindings (one-way)

Pass a function to derive a read-only view. This is shorthand for `derived([source], selector)`:

```ts
const upper = todo.bind((t) => t.title.toUpperCase()); // Readable<string>
```

## Selector + update bindings (two-way)

Pass a selector _and_ an update function to make a writable view with custom write-back logic. `update(prev, next)` either returns a new parent value, or mutates `prev` in place and returns nothing (the source is then flushed):

```ts
// immutable write-back
const title = todo.bind(
	(t) => t.title,
	(prev, next) => ({ ...prev, title: next }),
);

// or mutate in place
const name = todo.bind(
	(t) => t.author.name,
	(prev, next) => {
		prev.author.name = next;
	},
);
```

This is the tool for views a path can't express. An array element by id, a value with parsing/formatting between the DOM and the data, a field guarded by validation:

```ts
const amount = form.bind(
	(f) => String(f.cents / 100),
	(prev, next) => ({ ...prev, cents: Math.round(Number(next) * 100) }),
);

Input({ value: amount });
```

## How updates propagate

A binding subscribes to its **source** and only notifies when its own slice actually changed (compared deeply, like `set`). Sibling bindings don't disturb each other. Setting `todo.bind("title")` does not notify subscribers of `todo.bind("author.name")`.

Bindings also chain. `todo.bind("author").bind("name")` behaves like `todo.bind("author.name")`, and everything here composes with `ForEach`, whose rows are themselves signals you can `bind` into.

One kind of state still fights the replace-the-value model: sets and maps you'd rather mutate in place. That's what [reactive collections](/docs/reactive-collections) are for, up next.
