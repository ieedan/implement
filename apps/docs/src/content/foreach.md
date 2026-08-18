---
title: ForEach
description: Keyed list rendering with per-row signals, reordering, and write-back into the source list.
section: Control flow
order: 9
---

In almost every application you will find a need to render dynamic list data, and that's what `ForEach` is for. `ForEach(items, getKey, render)` renders a list where the key function gives every item a stable identity, so updates reuse, reorder, and remove existing rows instead of rebuilding the list.

```ts
import { ForEach, signal } from "@implementjs/core";

const todos = signal([
	{ id: 1, title: "Ship docs", done: false },
	{ id: 2, title: "Write tests", done: true },
]);

Ul(
	ForEach(
		todos,
		(todo) => todo.id,
		(todo) => Li(todo.bind("title")),
	),
);
```

## Keys

`getKey(item, index)` must return a string or number that is unique within the list. A duplicate key throws (with a stack pointing at the `ForEach` call site, not framework internals). The key decides what happens on update:

- **Same key present** means the existing row is kept. Its item signal is patched with the new value and it is moved into position if the list reordered.
- **New key** means a new row mounts.
- **Key gone** means that row unmounts.

> [!TIP]
> Using `(_, index) => index` as a key only works for append-only lists. Give real identities to anything that reorders or deletes.

## Rows receive signals

`render(item, index)` receives the item **as a signal** and the row's index as a `Readable<number>`. The row mounts once, and when the list updates the row's signals are patched in place. Nothing remounts:

```ts
ForEach(
	todos,
	(t) => t.id,
	(todo, index) => Li(Span(index.bind((i) => `${i + 1}. `)), Span(todo.bind("title"))),
);
```

## Writable rows: editing the list from inside a row

When the source list is a **writable** signal, each row's item signal is writable too. Setting it writes the change back into the source array (immutably, found by key):

```ts
ForEach(
	todos,
	(t) => t.id,
	(todo) =>
		Li(
			// two-way: checkbox ⇄ todo.done ⇄ the todos array itself
			Input({ type: "checkbox", checked: todo.bind("done") }),
			Input({ value: todo.bind("title") }),
		),
);
```

A read-only source (a `derived`, or a plain array) yields read-only rows.

## Adding and removing

Just mutate the source signal and the keyed reconciler does the rest. The [array helpers](/docs/signals) keep this terse:

```ts
todos.push({ id: nextId(), title: "", done: false });
todos.update((list) => list.filter((t) => !t.done));
```

## Filtering and sorting

Derive the view and hand it to `ForEach`. Rows keep their identity through the derived list because keys travel with the items:

```ts
const visible = derived([todos, filter], (list, f) =>
	f === "open" ? list.filter((t) => !t.done) : list,
);

ForEach(
	visible,
	(t) => t.id,
	(todo) => TodoRow(todo),
);
```

> [!NOTE]
> Rows of a derived list are read-only. Keep edits going through the source list.

Conditions, cases, and lists cover state you already have. The last big source of change is data that hasn't arrived yet, which is what [Await](/docs/await) is for.
