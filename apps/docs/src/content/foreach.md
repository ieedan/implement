---
title: ForEach
description: Keyed list rendering with per-row signals, reordering, and write-back into the source list.
order: 9
---

`ForEach(items, getKey, render)` renders a list. The key function gives every item a stable identity, so updates reuse, reorder, and remove existing rows instead of rebuilding the list.

```ts
import { ForEach, signal } from "@packages/implement";

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

`getKey(item, index)` must return a string or number, unique within the list — a duplicate key throws (with a stack pointing at the `ForEach` call site, not framework internals). The key decides what happens on update:

- **Same key present** → the existing row is kept; its item signal is patched with the new value and it is moved into position if the list reordered.
- **New key** → a new row mounts.
- **Key gone** → that row unmounts.

Using `(_, index) => index` as a key works only for append-only lists; give real identities to anything that reorders or deletes.

## Rows receive signals

`render(item, index)` receives the item **as a signal** and the row's index as a `Readable<number>`. The row mounts once; when the list updates, the row's signals are patched in place — nothing remounts:

```ts
ForEach(
	todos,
	(t) => t.id,
	(todo, index) => Li(Span(index.bind((i) => `${i + 1}. `)), Span(todo.bind("title"))),
);
```

## Writable rows: editing the list from inside a row

When the source list is a **writable** signal, each row's item signal is writable too — setting it writes the change back into the source array (immutably, found by key):

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

Mutate the source signal; the keyed reconciler does the rest. The [array helpers](/docs/signals) keep this terse:

```ts
todos.push({ id: nextId(), title: "", done: false });
todos.update((list) => list.filter((t) => !t.done));
```

## Filtering and sorting

Derive the view and hand it to `ForEach` — rows keep their identity through the derived list because keys travel with the items:

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

(Rows of a derived list are read-only; keep edits going through the source list.)
