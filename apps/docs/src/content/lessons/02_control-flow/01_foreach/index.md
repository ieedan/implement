---
title: ForEach
description: Render a keyed list that updates in place.
section: Control flow
---

In almost every application you will find a need to render dynamic list data.

In React this is a bit easier you just call `.map()` on your state and your list will update. However in implement this will render your list but the list will never update when your state changes.

```ts
// ⚠️ THIS WILL NEVER UPDATE
...todos.get().map((todo) => Li(todo.title))
```

This makes map a fine solution when you want to render a static list but useless for dynamic data. For dynamic data you need to use the `ForEach` component.

`ForEach` accepts an `Signal<T[]>`, a function to get a key, and finally a function to create it's children.

```ts
ForEach(
	items,
	(item) => item.id, // key must be unique!
	(item, index) => Item(item, index),
);
```

Try using `ForEach` to render the Todos in this Todo app example.

> [!TIP]
> You can use `todo.bind('title')` to reactively bind to the title of a todo within the `ForEach`.
