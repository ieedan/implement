---
title: Bindings
description: Focused views into a signal's value with bind — by path or by selector, one-way or two-way.
section: Reactivity
order: 6
---

`bind` creates a smaller signal out of a bigger one. It comes in three shapes.

## Path bindings

Pass a (possibly dotted) key path to get a view of that field. On a **writable** source the view is a `Signal`, so helpers like `toggle` and `push` work the same as on the source. Setting it writes an immutably-updated parent back into the source.

```ts
const todo = signal({
	title: "Ship docs",
	author: { name: "Ada" },
});

const title = todo.bind("title"); // Signal<string>
const author = todo.bind("author.name"); // Signal<string>

title.set("Ship v2");
// todo is now { title: "Ship v2", author: { name: "Ada" } } — a new object

Input({ value: title }); // two-way form binding through the path
```

Paths are fully typed, so `todo.bind("autor.name")` is a compile error. They walk through plain objects at any depth. Arrays, `Map`s, `Set`s, `Date`s, and functions are leaves, meaning you can bind _to_ them but not through them (index into arrays with a selector binding instead).

On a read-only source the same call returns a `Readable` of the path.

### Missing values

A path reads through a missing value the way optional chaining does: if anything along the way is `null` or `undefined`, the binding reads `undefined` and updates once the value arrives. This is what lets you bind into data that is not there yet — a `data` readable before its load lands, a [`Ref`](/docs/signals#element-references) before its node mounts:

```ts
const data = signal<{ issue?: { title: string } }>({});

const title = data.bind("issue").bind("title");
title.get(); // undefined, not a throw

data.set({ issue: { title: "Ship docs" } });
title.get(); // "Ship docs"
```

Writing is the other way around. `title.set("Ship v2")` while `issue` is missing throws, naming the segment that was: there is nowhere to put the value, and a write that silently goes nowhere is lost rather than merely absent.

## Selector bindings (one-way)

Pass a function to derive a read-only view. This is shorthand for `derived([source], selector)`:

```ts
const upper = todo.bind((t) => t.title.toUpperCase()); // Readable<string>
```

## Selector + update bindings (two-way)

Pass a selector _and_ an update function to make a `Signal` with custom write-back logic. `update(prev, next)` either returns a new parent value, or mutates `prev` in place and returns nothing (the source is then flushed):

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

A two-way bind needs somewhere to write, so it throws on a read-only source. That is worth knowing because a readable can reach one through a prop the types call a `Signal` — a route's `data`, and anything bound off it, is read-only:

```ts
const issue = data.bind("issue"); // Readable, not Signal
LabelPicker({ value: issue.bind((i) => i.labels.map((l) => l.id)) }); // still a Readable
```

Give the component a signal of its own and write the change back through an action instead.

## How updates propagate

A binding subscribes to its **source** and only notifies when its own slice actually changed (compared deeply, like `set`). Sibling bindings don't disturb each other. Setting `todo.bind("title")` does not notify subscribers of `todo.bind("author.name")`.

Bindings also chain. `todo.bind("author").bind("name")` behaves like `todo.bind("author.name")`, and everything here composes with `ForEach`, whose rows are themselves signals you can `bind` into.

One kind of state still fights the replace-the-value model: sets and maps you'd rather mutate in place. That's what [reactive collections](/docs/reactive-collections) are for, up next.
