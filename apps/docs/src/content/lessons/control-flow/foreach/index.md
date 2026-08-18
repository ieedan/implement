---
title: ForEach
description: Render a keyed list that updates in place.
section: Control flow
order: 7
---

`ForEach(items, getKey, render)` renders a list. The key gives each row a stable identity, so later updates reuse and reorder existing rows instead of rebuilding everything.

```ts
ForEach(
	todos,
	(todo) => todo.id,
	(todo) => Li(todo.bind("title")),
);
```

Each row receives the item as a signal. `bind("title")` is a live view of that field.

Render the `todos` signal as a list. Use `todo.id` as the key and show each title.
