---
title: prefer-foreach
description: A list rendered from .get().map(), which draws once and never updates.
section: Rules
order: 14
---

`get()` reads a signal once. Map over that and you have rendered the list as it was at mount, with nothing left subscribed to change it:

```ts
// renders once and never updates
Ul(...rows.get().map((row) => Li(row)));

// re-renders as `rows` changes
Ul(
	ForEach(
		rows,
		(row) => row.id,
		(row) => Li(row),
	),
);
```

The rule reports `.get().map()` **only in a rendered position** — as an argument, or a spread argument, of a PascalCase callee. That is what separates a list being rendered from one being sent somewhere, and it keeps the rule quiet on the case where reading the current value is exactly right:

```ts
// fine — an event handler wants the value it has now
Button({ onClick: () => save(rows.get().map(toDto)) }, "Save");
```

`Map.prototype.get` takes a key, so `byId.get(id).map(...)` is never mistaken for the snapshot read.
